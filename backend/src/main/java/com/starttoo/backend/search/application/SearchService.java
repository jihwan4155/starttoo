package com.starttoo.backend.search.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.post.api.PostDtos;
import com.starttoo.backend.post.application.PostService;
import com.starttoo.backend.search.api.SearchDtos;
import com.starttoo.backend.search.application.RedisSearchGateway.SearchCandidate;
import com.starttoo.backend.user.domain.UserRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.DefaultTypedTuple;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.sql.Types;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private static final String ACCOUNT_KEY = "autocomplete:accounts";
    private static final String ARTIST_KEY = "autocomplete:artists";
    private static final String SUBJECT_KEY = "autocomplete:subjects";
    private static final String ACCOUNT_MEMBER_LOOKUP = "autocomplete:accounts:members";
    private static final String ARTIST_MEMBER_LOOKUP = "autocomplete:artists:members";
    private static final String SUBJECT_MEMBER_LOOKUP = "autocomplete:subjects:members";
    private static final String SUBJECT_COUNTS = "search:subjects:query-count";
    private static final String DELIMITER = "\u0001";
    private static final long MAX_COUNTED_SUBJECTS = 100_000;
    @SuppressWarnings("rawtypes")
    private static final DefaultRedisScript<List> PREFIX_SCRIPT = new DefaultRedisScript<>(
            "return redis.call('ZRANGEBYLEX', KEYS[1], ARGV[1], ARGV[2], 'LIMIT', 0, ARGV[3])",
            List.class
    );

    private final StringRedisTemplate redisTemplate;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;
    private final KoreanJamoNormalizer jamoNormalizer;
    private final SearchLogService searchLogService;
    private final RedisSearchGateway redisSearchGateway;
    private final PostService postService;
    private final MediaService mediaService;

    @EventListener(ApplicationReadyEvent.class)
    public void initialize() {
        try {
            searchLogService.restoreSubjectCountsIfMissing();
            boolean rebuildRequired = redisSearchGateway.prepareIndexes()
                    || !Boolean.TRUE.equals(redisTemplate.hasKey(ACCOUNT_KEY));
            if (rebuildRequired) {
                // prepareIndexes를 이미 수행했으므로 문서 적재만 진행한다.
                rebuildDocuments();
            } else {
                refreshSubjectAutocomplete();
            }
        } catch (RuntimeException exception) {
            log.warn("Search initialization deferred: {}", exception.getMessage());
        }
    }

    /**
     * 실시간 변경은 AFTER_COMMIT 이벤트로 반영하고, 이 작업은 누락·불일치를 복구하는
     * 저빈도 전체 대조 작업으로만 사용한다.
     */
    @Scheduled(cron = "${app.search.reconciliation-cron:0 0 4 * * *}", zone = "UTC")
    public void reconcileIndexes() {
        rebuildIndexes();
    }

    @Scheduled(fixedDelayString = "${app.search.autocomplete-refresh-delay:600000}")
    public void refreshSubjectAutocomplete() {
        try {
            rebuildSubjectAutocomplete();
        } catch (RuntimeException exception) {
            log.warn("Subject autocomplete refresh skipped: {}", exception.getMessage());
        }
    }

    public void rebuildIndexes() {
        try {
            redisSearchGateway.prepareIndexes();
            rebuildDocuments();
        } catch (RuntimeException exception) {
            log.warn("Search index reconciliation skipped: {}", exception.getMessage());
        }
    }

    private void rebuildDocuments() {
        rebuildAccounts();
        rebuildSubjects();
        redisSearchGateway.markRebuilt();
    }

    @TransactionalEventListener(
            phase = TransactionPhase.AFTER_COMMIT,
            fallbackExecution = true
    )
    public void synchronizeAfterCommit(SearchIndexChangedEvent event) {
        try {
            switch (event.targetType()) {
                case ACCOUNT -> synchronizeAccount(event.targetSeq());
                case SUBJECT -> synchronizeSubject(event.targetSeq());
            }
        } catch (RuntimeException exception) {
            // DB 커밋은 이미 끝났으므로 검색 장애가 업무 트랜잭션을 되돌리지는 않는다.
            // 다음 동일 엔티티 변경 또는 일일 대조 작업이 누락을 복구한다.
            log.warn(
                    "Search index incremental update failed. type={}, seq={}",
                    event.targetType(),
                    event.targetSeq(),
                    exception
            );
        }
    }

    public List<SearchDtos.AccountResult> autocompleteAccounts(String query, int size) {
        return autocompleteAccounts(ACCOUNT_KEY, query, size, false);
    }

    public List<SearchDtos.AccountResult> autocompleteArtists(String query, int size) {
        return autocompleteAccounts(ARTIST_KEY, query, size, true);
    }

    public List<SearchDtos.SubjectResult> autocompleteSubjects(String query, int size) {
        int safeSize = Math.min(Math.max(size, 1), 20);
        String prefix = jamoNormalizer.normalize(query);
        List<Integer> ids = members(
                SUBJECT_KEY,
                prefix,
                Math.min(Math.max(safeSize * 10, 100), 200)
        ).stream().map(this::idValue).toList();
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Integer, SearchDtos.SubjectResult> byId = subjectResultMap(ids);
        return ids.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparingInt((SearchDtos.SubjectResult value) ->
                                value.subjectName().equals(query) ? 0 : 1)
                        .thenComparingInt(value -> value.subjectName().length())
                        .thenComparing(SearchDtos.SubjectResult::subjectName))
                .limit(safeSize)
                .toList();
    }

    public List<SearchDtos.AccountResult> searchAccounts(
            String query,
            int size,
            boolean artistsOnly
    ) {
        searchLogService.record(null, artistsOnly ? "ARTIST" : "ACCOUNT", query);
        int safeSize = Math.min(Math.max(size, 1), 50);
        int candidateLimit = Math.min(Math.max(safeSize * 10, 100), 500);
        String normalizedQuery = jamoNormalizer.normalize(query);
        List<SearchCandidate> candidates = artistsOnly
                ? redisSearchGateway.artistCandidates(normalizedQuery, candidateLimit)
                : redisSearchGateway.accountCandidates(normalizedQuery, candidateLimit);
        return accountResults(candidates, safeSize, artistsOnly);
    }

    public SearchDtos.PostSearchResponse searchPosts(
            Integer userSeq,
            String query,
            Long cursor,
            int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        List<SubjectCandidate> candidates = subjectCandidates(query, 250);
        if (candidates.isEmpty()) {
            searchLogService.recordPostSearch(userSeq, query, null, null);
            return new SearchDtos.PostSearchResponse(
                    query,
                    null,
                    null,
                    List.of(),
                    null,
                    false,
                    0
            );
        }
        SubjectCandidate canonical = candidates.get(0);

        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("subjectSeq", canonical.subjectSeq(), Types.INTEGER)
                .addValue("userSeq", userSeq, Types.INTEGER)
                .addValue("cursor", cursor, Types.BIGINT)
                .addValue("limit", safeSize + 1, Types.INTEGER);
        List<Long> ids = namedParameterJdbcTemplate.queryForList("""
                SELECT DISTINCT post.post_seq
                  FROM tattoo_subjects tattoo_subject
                  JOIN tattoos tattoo
                    ON tattoo.tattoo_seq = tattoo_subject.tattoo_seq
                   AND tattoo.is_deleted = FALSE
                  JOIN post_images post_image
                    ON post_image.image_seq = tattoo.image_seq
                  JOIN posts post
                    ON post.post_seq = post_image.post_seq
                   AND post.post_status = 'PUBLISHED'
                   AND post.is_deleted = FALSE
                  JOIN users author
                    ON author.user_seq = post.author_seq
                   AND author.account_status = 'ACTIVE'
                   AND author.role <> 'ADMIN'
                   AND author.is_deleted = FALSE
                 WHERE tattoo_subject.subject_seq = :subjectSeq
                   AND (:cursor IS NULL OR post.post_seq < :cursor)
                   AND (
                       :userSeq IS NULL OR NOT EXISTS (
                           SELECT 1
                             FROM user_blocks block
                            WHERE (
                                block.blocker_seq = :userSeq
                                AND block.blocked_seq = post.author_seq
                            ) OR (
                                block.blocker_seq = post.author_seq
                                AND block.blocked_seq = :userSeq
                            )
                       )
                   )
                   AND (
                       :userSeq IS NULL OR NOT EXISTS (
                           SELECT 1
                             FROM post_hidden_preferences hidden
                            WHERE hidden.post_seq = post.post_seq
                              AND hidden.user_seq = :userSeq
                       )
                   )
                 ORDER BY post.post_seq DESC
                 LIMIT :limit
                """,
                parameters,
                Long.class
        );
        boolean hasNext = ids.size() > safeSize;
        List<Long> page = hasNext ? ids.subList(0, safeSize) : ids;
        Map<Long, Long> matchedImages = matchedImages(page, canonical.subjectSeq());
        List<PostDtos.PostResponse> items = page.isEmpty()
                ? List.of()
                : postService.responsesBySeqs(page, userSeq).stream()
                .map(post -> post.withMatchedImageSeq(matchedImages.get(post.postSeq())))
                .toList();
        searchLogService.recordPostSearch(
                userSeq,
                query,
                canonical.subjectSeq(),
                canonical.subjectName()
        );
        return new SearchDtos.PostSearchResponse(
                query,
                new SearchDtos.SubjectResult(
                        canonical.subjectSeq(),
                        canonical.subjectName()
                ),
                canonical.matchTier().name(),
                items,
                hasNext ? page.get(page.size() - 1).toString() : null,
                hasNext,
                items.size()
        );
    }

    /**
     * 게시물 단위 검색은 같은 subject가 붙은 여러 사진을 하나의 카드로 합친다.
     * 그 과정에서도 실제로 검색에 걸린 사진을 잃지 않도록, 게시물 안에서 가장 앞선
     * 일치 사진의 imageSeq를 대표 검색 이미지로 선택한다.
     */
    private Map<Long, Long> matchedImages(List<Long> postSeqs, Integer subjectSeq) {
        if (postSeqs.isEmpty()) {
            return Map.of();
        }
        Map<Long, Long> matched = new LinkedHashMap<>();
        namedParameterJdbcTemplate.query("""
                SELECT DISTINCT ON (post_image.post_seq)
                       post_image.post_seq,
                       post_image.image_seq
                  FROM post_images post_image
                  JOIN tattoos tattoo
                    ON tattoo.image_seq = post_image.image_seq
                   AND tattoo.is_deleted = FALSE
                  JOIN tattoo_subjects tattoo_subject
                    ON tattoo_subject.tattoo_seq = tattoo.tattoo_seq
                 WHERE post_image.post_seq IN (:postSeqs)
                   AND tattoo_subject.subject_seq = :subjectSeq
                 ORDER BY post_image.post_seq,
                          post_image.display_order,
                          post_image.post_image_seq
                """, new MapSqlParameterSource()
                .addValue("postSeqs", postSeqs)
                .addValue("subjectSeq", subjectSeq), rs -> {
            matched.put(rs.getLong("post_seq"), rs.getLong("image_seq"));
        });
        return matched;
    }

    private List<SearchDtos.AccountResult> autocompleteAccounts(
            String key,
            String query,
            int size,
            boolean artistsOnly
    ) {
        int safeSize = Math.min(Math.max(size, 1), 20);
        List<Integer> ids = members(
                key,
                jamoNormalizer.normalize(query),
                Math.min(Math.max(safeSize * 10, 100), 200)
        ).stream().map(this::idValue).toList();
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Integer, SearchDtos.AccountResult> byId = accountResultMap(ids, artistsOnly);
        return ids.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparingInt((SearchDtos.AccountResult value) ->
                                value.nickname().equalsIgnoreCase(query) ? 0 : 1)
                        .thenComparingInt(value -> value.nickname().length())
                        .thenComparing(SearchDtos.AccountResult::nickname))
                .limit(safeSize)
                .toList();
    }

    private List<SearchDtos.AccountResult> accountResults(
            List<SearchCandidate> candidates,
            int size,
            boolean artistsOnly
    ) {
        if (candidates.isEmpty()) {
            return List.of();
        }
        List<Integer> ids = candidates.stream().map(SearchCandidate::targetSeq).toList();
        Map<Integer, SearchDtos.AccountResult> byId = accountResultMap(ids, artistsOnly);
        // Redis가 반환한 tier와 점수 순서를 그대로 보존한다. PostgreSQL은 최신 노출
        // 상태를 재검증하고 화면 필드만 공급한다.
        return candidates.stream()
                .map(candidate -> byId.get(candidate.targetSeq()))
                .filter(Objects::nonNull)
                .limit(size)
                .toList();
    }

    private Map<Integer, SearchDtos.AccountResult> accountResultMap(
            List<Integer> ids,
            boolean artistsOnly
    ) {
        Map<Integer, SearchDtos.AccountResult> byId = new LinkedHashMap<>();
        namedParameterJdbcTemplate.query("""
                SELECT u.user_seq, u.nickname, u.role,
                       u.profile_image_seq,
                       profile_image.object_key AS profile_object_key,
                       COALESCE(
                           u.role = 'ARTIST'
                           AND a.verification_status = 'VERIFIED',
                           FALSE
                       ) AS verified
                  FROM users u
                  LEFT JOIN artists a
                    ON a.user_seq = u.user_seq
                   AND a.is_deleted = FALSE
                  LEFT JOIN images profile_image
                    ON profile_image.image_seq = u.profile_image_seq
                   AND profile_image.is_deleted = FALSE
                 WHERE u.user_seq IN (:ids)
                   AND u.role <> 'ADMIN'
                   AND u.account_status = 'ACTIVE'
                   AND u.is_deleted = FALSE
                   AND (
                       :artistsOnly = FALSE
                       OR (
                           u.role = 'ARTIST'
                           AND a.verification_status = 'VERIFIED'
                       )
                   )
                """, new MapSqlParameterSource()
                .addValue("ids", ids)
                .addValue("artistsOnly", artistsOnly), rs -> {
            String profileObjectKey = rs.getString("profile_object_key");
            SearchDtos.AccountResult value = new SearchDtos.AccountResult(
                    rs.getInt("user_seq"),
                    rs.getString("nickname"),
                    UserRole.valueOf(rs.getString("role")),
                    rs.getObject("profile_image_seq", Long.class),
                    profileObjectKey == null
                            ? null
                            : mediaService.downloadUrl(profileObjectKey),
                    rs.getBoolean("verified")
            );
            byId.put(value.userSeq(), value);
        });
        return byId;
    }

    private Map<Integer, SearchDtos.SubjectResult> subjectResultMap(List<Integer> ids) {
        Map<Integer, SearchDtos.SubjectResult> byId = new LinkedHashMap<>();
        namedParameterJdbcTemplate.query("""
                SELECT subject_seq, subject_name
                  FROM subjects
                 WHERE subject_seq IN (:ids)
                """, new MapSqlParameterSource("ids", ids), rs -> {
            SearchDtos.SubjectResult value = new SearchDtos.SubjectResult(
                    rs.getInt("subject_seq"),
                    rs.getString("subject_name")
            );
            byId.put(value.subjectSeq(), value);
        });
        return byId;
    }

    private List<SubjectCandidate> subjectCandidates(String query, int candidateLimit) {
        String normalizedQuery = jamoNormalizer.normalize(query);
        List<SearchCandidate> candidates = redisSearchGateway.subjectCandidates(
                normalizedQuery,
                candidateLimit
        );
        if (candidates.isEmpty()) {
            return List.of();
        }
        List<Integer> ids = candidates.stream().map(SearchCandidate::targetSeq).toList();
        Map<Integer, String> names = new LinkedHashMap<>();
        namedParameterJdbcTemplate.query("""
                SELECT subject_seq, subject_name
                  FROM subjects
                 WHERE subject_seq IN (:ids)
                """, new MapSqlParameterSource("ids", ids), rs -> {
            // 변경: 반환값이 있는 Map.put 표현식 람다는 ResultSetExtractor와
            // RowCallbackHandler 양쪽으로 추론될 수 있으므로 void 블록으로 명시한다.
            names.put(rs.getInt("subject_seq"), rs.getString("subject_name"));
        });
        return candidates.stream()
                .filter(candidate -> names.containsKey(candidate.targetSeq()))
                .map(candidate -> new SubjectCandidate(
                        candidate.targetSeq(),
                        names.get(candidate.targetSeq()),
                        candidate.matchTier(),
                        candidate.redisScore(),
                        candidate.candidateOrder()
                ))
                .toList();
    }

    private void rebuildAccounts() {
        Set<org.springframework.data.redis.core.ZSetOperations.TypedTuple<String>> accounts =
                new LinkedHashSet<>();
        Set<org.springframework.data.redis.core.ZSetOperations.TypedTuple<String>> artists =
                new LinkedHashSet<>();
        Map<String, String> accountMembers = new LinkedHashMap<>();
        Map<String, String> artistMembers = new LinkedHashMap<>();
        Map<Integer, String> accountDocuments = new LinkedHashMap<>();
        Map<Integer, String> artistDocuments = new LinkedHashMap<>();
        jdbcTemplate.query("""
                SELECT u.user_seq, u.nickname, u.role,
                       COALESCE(a.verification_status, '') AS verification_status
                  FROM users u
                  LEFT JOIN artists a ON a.user_seq = u.user_seq AND a.is_deleted = FALSE
                 WHERE u.role <> 'ADMIN'
                   AND u.account_status = 'ACTIVE'
                   AND u.is_deleted = FALSE
                """, rs -> {
            Integer userSeq = rs.getInt("user_seq");
            String normalized = jamoNormalizer.normalize(rs.getString("nickname"));
            String member = normalized + DELIMITER + userSeq;
            accounts.add(new DefaultTypedTuple<>(member, 0.0));
            accountMembers.put(userSeq.toString(), member);
            accountDocuments.put(userSeq, normalized);
            if ("ARTIST".equals(rs.getString("role"))
                    && "VERIFIED".equals(rs.getString("verification_status"))) {
                artists.add(new DefaultTypedTuple<>(member, 0.0));
                artistMembers.put(userSeq.toString(), member);
                artistDocuments.put(userSeq, normalized);
            }
        });
        replace(ACCOUNT_KEY, accounts);
        replace(ARTIST_KEY, artists);
        replaceHash(ACCOUNT_MEMBER_LOOKUP, accountMembers);
        replaceHash(ARTIST_MEMBER_LOOKUP, artistMembers);
        redisSearchGateway.replaceAccounts(accountDocuments);
        redisSearchGateway.replaceArtists(artistDocuments);
    }

    private void rebuildSubjects() {
        Map<Integer, String> subjectDocuments = new LinkedHashMap<>();
        jdbcTemplate.query("""
                SELECT subject_seq, subject_name
                  FROM subjects
                """, rs -> {
            Integer subjectSeq = rs.getInt("subject_seq");
            String subject = rs.getString("subject_name");
            subjectDocuments.put(subjectSeq, jamoNormalizer.normalize(subject));
        });
        redisSearchGateway.replaceSubjects(subjectDocuments);
        rebuildSubjectAutocomplete();
    }

    private void rebuildSubjectAutocomplete() {
        Set<org.springframework.data.redis.core.ZSetOperations.TypedTuple<String>> subjects =
                new LinkedHashSet<>();
        Map<String, String> subjectMembers = new LinkedHashMap<>();
        jdbcTemplate.query("""
                SELECT s.subject_seq, s.subject_name, COUNT(t.tattoo_seq) AS frequency
                  FROM subjects s
                  LEFT JOIN tattoo_subjects ts ON ts.subject_seq = s.subject_seq
                  LEFT JOIN tattoos t
                    ON t.tattoo_seq = ts.tattoo_seq
                   AND t.is_deleted = FALSE
                 GROUP BY s.subject_seq, s.subject_name
                 ORDER BY frequency DESC, s.subject_name
                 LIMIT 2000
                """, rs -> {
            Integer subjectSeq = rs.getInt("subject_seq");
            String subject = rs.getString("subject_name");
            String member = jamoNormalizer.normalize(subject) + DELIMITER + subjectSeq;
            subjects.add(new DefaultTypedTuple<>(
                    member,
                    0.0
            ));
            subjectMembers.put(subjectSeq.toString(), member);
        });

        Set<String> searchedSubjectSeqs = redisTemplate.opsForZSet()
                .reverseRange(SUBJECT_COUNTS, 0, 999);
        if (searchedSubjectSeqs != null && !searchedSubjectSeqs.isEmpty()) {
            List<Integer> ids = searchedSubjectSeqs.stream()
                    .map(this::safeInteger)
                    .filter(Objects::nonNull)
                    .toList();
            if (!ids.isEmpty()) {
                namedParameterJdbcTemplate.query("""
                        SELECT subject_seq, subject_name
                          FROM subjects
                         WHERE subject_seq IN (:ids)
                        """, new MapSqlParameterSource("ids", ids), rs -> {
                    Integer subjectSeq = rs.getInt("subject_seq");
                    String subject = rs.getString("subject_name");
                    String member = jamoNormalizer.normalize(subject)
                            + DELIMITER + subjectSeq;
                    subjects.add(new DefaultTypedTuple<>(
                            member,
                            0.0
                    ));
                    subjectMembers.put(subjectSeq.toString(), member);
                });
            }
        }

        Long countedSubjects = redisTemplate.opsForZSet().zCard(SUBJECT_COUNTS);
        if (countedSubjects != null && countedSubjects > MAX_COUNTED_SUBJECTS) {
            redisTemplate.opsForZSet().removeRange(
                    SUBJECT_COUNTS,
                    0,
                    countedSubjects - MAX_COUNTED_SUBJECTS - 1
            );
        }
        replace(SUBJECT_KEY, subjects);
        replaceHash(SUBJECT_MEMBER_LOOKUP, subjectMembers);
    }

    private void synchronizeAccount(Integer userSeq) {
        List<AccountIndexRow> rows = jdbcTemplate.query("""
                SELECT u.nickname,
                       u.role,
                       u.account_status,
                       u.is_deleted,
                       COALESCE(a.verification_status, '') AS verification_status
                  FROM users u
                  LEFT JOIN artists a
                    ON a.user_seq = u.user_seq
                   AND a.is_deleted = FALSE
                 WHERE u.user_seq = ?
                """, (rs, rowNum) -> new AccountIndexRow(
                rs.getString("nickname"),
                rs.getString("role"),
                rs.getString("account_status"),
                rs.getBoolean("is_deleted"),
                rs.getString("verification_status")
        ), userSeq);

        if (rows.isEmpty()) {
            removeAccountEntries(userSeq);
            return;
        }
        AccountIndexRow row = rows.get(0);
        boolean accountEligible = !row.deleted()
                && "ACTIVE".equals(row.accountStatus())
                && !"ADMIN".equals(row.role());
        if (!accountEligible) {
            removeAccountEntries(userSeq);
            return;
        }

        String normalized = jamoNormalizer.normalize(row.nickname());
        redisSearchGateway.upsertAccount(userSeq, normalized);
        synchronizeAutocompleteMember(
                ACCOUNT_KEY,
                ACCOUNT_MEMBER_LOOKUP,
                userSeq,
                normalized + DELIMITER + userSeq
        );

        boolean artistEligible = "ARTIST".equals(row.role())
                && "VERIFIED".equals(row.verificationStatus());
        if (artistEligible) {
            redisSearchGateway.upsertArtist(userSeq, normalized);
            synchronizeAutocompleteMember(
                    ARTIST_KEY,
                    ARTIST_MEMBER_LOOKUP,
                    userSeq,
                    normalized + DELIMITER + userSeq
            );
        } else {
            redisSearchGateway.removeArtist(userSeq);
            synchronizeAutocompleteMember(ARTIST_KEY, ARTIST_MEMBER_LOOKUP, userSeq, null);
        }
    }

    private void removeAccountEntries(Integer userSeq) {
        redisSearchGateway.removeAccount(userSeq);
        redisSearchGateway.removeArtist(userSeq);
        synchronizeAutocompleteMember(ACCOUNT_KEY, ACCOUNT_MEMBER_LOOKUP, userSeq, null);
        synchronizeAutocompleteMember(ARTIST_KEY, ARTIST_MEMBER_LOOKUP, userSeq, null);
    }

    private void synchronizeSubject(Integer subjectSeq) {
        List<String> names = jdbcTemplate.queryForList(
                "SELECT subject_name FROM subjects WHERE subject_seq = ?",
                String.class,
                subjectSeq
        );
        if (names.isEmpty()) {
            redisSearchGateway.removeSubject(subjectSeq);
            synchronizeAutocompleteMember(
                    SUBJECT_KEY,
                    SUBJECT_MEMBER_LOOKUP,
                    subjectSeq,
                    null
            );
            return;
        }
        String normalized = jamoNormalizer.normalize(names.get(0));
        redisSearchGateway.upsertSubject(subjectSeq, normalized);
        synchronizeAutocompleteMember(
                SUBJECT_KEY,
                SUBJECT_MEMBER_LOOKUP,
                subjectSeq,
                normalized + DELIMITER + subjectSeq
        );
    }

    private void synchronizeAutocompleteMember(
            String zsetKey,
            String lookupKey,
            Integer id,
            String newMember
    ) {
        Object existing = redisTemplate.opsForHash().get(lookupKey, id.toString());
        if (existing != null) {
            redisTemplate.opsForZSet().remove(zsetKey, existing.toString());
        }
        if (newMember == null) {
            redisTemplate.opsForHash().delete(lookupKey, id.toString());
            return;
        }
        redisTemplate.opsForZSet().add(zsetKey, newMember, 0);
        redisTemplate.opsForHash().put(lookupKey, id.toString(), newMember);
    }

    private void replace(
            String key,
            Set<org.springframework.data.redis.core.ZSetOperations.TypedTuple<String>> tuples
    ) {
        String temporary = key + ":rebuild:" + UUID.randomUUID();
        redisTemplate.delete(temporary);
        if (tuples.isEmpty()) {
            redisTemplate.delete(key);
            return;
        }
        redisTemplate.opsForZSet().add(temporary, tuples);
        redisTemplate.rename(temporary, key);
    }

    private void replaceHash(String key, Map<String, String> values) {
        String temporary = key + ":rebuild:" + UUID.randomUUID();
        redisTemplate.delete(temporary);
        if (values.isEmpty()) {
            redisTemplate.delete(key);
            return;
        }
        redisTemplate.opsForHash().putAll(temporary, values);
        redisTemplate.rename(temporary, key);
    }

    @SuppressWarnings("unchecked")
    private List<String> members(String key, String prefix, int size) {
        if (prefix.isBlank()) {
            return List.of();
        }
        try {
            List<String> result = (List<String>) redisTemplate.execute(
                    PREFIX_SCRIPT,
                    List.of(key),
                    "[" + prefix,
                    "[" + prefix + "\uffff",
                    Integer.toString(size)
            );
            return result == null ? List.of() : result;
        } catch (RuntimeException exception) {
            throw new BusinessException(
                    ErrorCode.SERVICE_UNAVAILABLE,
                    "검색 자동완성을 일시적으로 사용할 수 없습니다."
            );
        }
    }

    private Integer idValue(String member) {
        return Integer.valueOf(lastValue(member));
    }

    private String lastValue(String member) {
        return member.substring(member.lastIndexOf(DELIMITER) + 1);
    }

    private Integer safeInteger(String value) {
        try {
            return Integer.valueOf(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private record SubjectCandidate(
            Integer subjectSeq,
            String subjectName,
            RedisSearchGateway.MatchTier matchTier,
            double redisScore,
            int candidateOrder
    ) {
    }

    private record AccountIndexRow(
            String nickname,
            String role,
            String accountStatus,
            boolean deleted,
            String verificationStatus
    ) {
    }
}
