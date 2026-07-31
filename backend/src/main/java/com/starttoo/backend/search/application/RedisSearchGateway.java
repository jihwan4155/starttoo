package com.starttoo.backend.search.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import io.lettuce.core.codec.ByteArrayCodec;
import io.lettuce.core.api.async.BaseRedisAsyncCommands;
import io.lettuce.core.api.sync.BaseRedisCommands;
import io.lettuce.core.output.NestedMultiOutput;
import io.lettuce.core.protocol.CommandArgs;
import io.lettuce.core.protocol.ProtocolKeyword;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.UUID;

@Component
@Slf4j
@RequiredArgsConstructor
public class RedisSearchGateway {

    private static final String INDEX_VERSION = "2";
    private static final String INDEX_VERSION_KEY = "search:index:version";

    private static final String ACCOUNT_INDEX = "idx:search:accounts";
    private static final String ARTIST_INDEX = "idx:search:artists";
    private static final String SUBJECT_INDEX = "idx:search:subjects";

    private static final String ACCOUNT_PREFIX = "search:account:";
    private static final String ARTIST_PREFIX = "search:artist:";
    private static final String SUBJECT_PREFIX = "search:subject:";

    private static final String ACCOUNT_MANIFEST = "search:index:accounts:documents";
    private static final String ARTIST_MANIFEST = "search:index:artists:documents";
    private static final String SUBJECT_MANIFEST = "search:index:subjects:documents";

    private static final String NORMALIZED_FIELD = "normalized";
    private static final String EXACT_FIELD = "normalized_exact";
    private static final int SEARCH_TIMEOUT_MILLIS = 150;

    private final StringRedisTemplate redisTemplate;

    /**
     * Redis ?, ???? ?? ?? ???? ?????.
     * true? PostgreSQL ??????? ? ??.
     */
    public boolean prepareIndexes() {
        Set<String> indexes = rawStringSet(execute("FT._LIST"));
        boolean versionChanged = !INDEX_VERSION.equals(
                redisTemplate.opsForValue().get(INDEX_VERSION_KEY)
        );
        if (versionChanged) {
            dropIndexIfPresent(indexes, ACCOUNT_INDEX);
            dropIndexIfPresent(indexes, ARTIST_INDEX);
            dropIndexIfPresent(indexes, SUBJECT_INDEX);
            indexes = Set.of();
        }

        boolean created = ensureIndex(indexes, ACCOUNT_INDEX, ACCOUNT_PREFIX);
        created |= ensureIndex(indexes, ARTIST_INDEX, ARTIST_PREFIX);
        created |= ensureIndex(indexes, SUBJECT_INDEX, SUBJECT_PREFIX);
        return versionChanged || created;
    }

    public void ensureIndexes() {
        prepareIndexes();
    }

    public void markRebuilt() {
        redisTemplate.opsForValue().set(INDEX_VERSION_KEY, INDEX_VERSION);
    }

    public void replaceAccounts(Map<Integer, String> documents) {
        replaceDocuments(ACCOUNT_PREFIX, ACCOUNT_MANIFEST, documents);
    }

    public void replaceArtists(Map<Integer, String> documents) {
        replaceDocuments(ARTIST_PREFIX, ARTIST_MANIFEST, documents);
    }

    public void replaceSubjects(Map<Integer, String> documents) {
        replaceDocuments(SUBJECT_PREFIX, SUBJECT_MANIFEST, documents);
    }

    public void upsertAccount(Integer userSeq, String normalized) {
        upsertDocument(ACCOUNT_PREFIX, ACCOUNT_MANIFEST, userSeq, normalized);
    }

    public void upsertArtist(Integer userSeq, String normalized) {
        upsertDocument(ARTIST_PREFIX, ARTIST_MANIFEST, userSeq, normalized);
    }

    public void upsertSubject(Integer subjectSeq, String normalized) {
        upsertDocument(SUBJECT_PREFIX, SUBJECT_MANIFEST, subjectSeq, normalized);
    }

    public void removeAccount(Integer userSeq) {
        removeDocument(ACCOUNT_PREFIX, ACCOUNT_MANIFEST, userSeq);
    }

    public void removeArtist(Integer userSeq) {
        removeDocument(ARTIST_PREFIX, ARTIST_MANIFEST, userSeq);
    }

    public void removeSubject(Integer subjectSeq) {
        removeDocument(SUBJECT_PREFIX, SUBJECT_MANIFEST, subjectSeq);
    }

    public List<SearchCandidate> accountCandidates(String normalizedQuery, int limit) {
        return candidates(ACCOUNT_INDEX, ACCOUNT_PREFIX, normalizedQuery, limit);
    }

    public List<SearchCandidate> artistCandidates(String normalizedQuery, int limit) {
        return candidates(ARTIST_INDEX, ARTIST_PREFIX, normalizedQuery, limit);
    }

    public List<SearchCandidate> subjectCandidates(String normalizedQuery, int limit) {
        return candidates(SUBJECT_INDEX, SUBJECT_PREFIX, normalizedQuery, limit);
    }

    private boolean ensureIndex(Set<String> indexes, String index, String prefix) {
        if (indexes.contains(index)) {
            return false;
        }
        execute(
                "FT.CREATE",
                index,
                "ON", "HASH",
                "PREFIX", "1", prefix,
                "STOPWORDS", "0",
                "SCHEMA",
                NORMALIZED_FIELD, "TEXT", "NOSTEM", "WITHSUFFIXTRIE",
                EXACT_FIELD, "TAG", "SEPARATOR", "\u0002",
                "CASESENSITIVE", "WITHSUFFIXTRIE"
        );
        return true;
    }

    private void dropIndexIfPresent(Set<String> indexes, String index) {
        if (indexes.contains(index)) {
            // DD???? ?  HASH ??? ??? ?.
            execute("FT.DROPINDEX", index);
        }
    }

    private void replaceDocuments(
            String documentPrefix,
            String manifestKey,
            Map<Integer, String> documents
    ) {
        Set<String> currentKeys = new LinkedHashSet<>();
        documents.keySet().forEach(id -> currentKeys.add(documentPrefix + id));

        Set<String> previousKeys = redisTemplate.opsForSet().members(manifestKey);
        Set<String> staleKeys = previousKeys == null
                ? new LinkedHashSet<>()
                : new LinkedHashSet<>(previousKeys);
        staleKeys.removeAll(currentKeys);

        redisTemplate.executePipelined((RedisCallback<Object>) connection -> {
            documents.forEach((id, normalized) -> connection.execute(
                    "HSET",
                    bytes(documentPrefix + id),
                    bytes(NORMALIZED_FIELD),
                    bytes(normalized),
                    bytes(EXACT_FIELD),
                    bytes(normalized)
            ));
            staleKeys.forEach(key -> connection.execute("DEL", bytes(key)));
            return null;
        });

        replaceManifest(manifestKey, currentKeys);
    }

    private void upsertDocument(
            String documentPrefix,
            String manifestKey,
            Integer id,
            String normalized
    ) {
        String key = documentPrefix + id;
        execute(
                "HSET",
                key,
                NORMALIZED_FIELD, normalized,
                EXACT_FIELD, normalized
        );
        redisTemplate.opsForSet().add(manifestKey, key);
    }

    private void removeDocument(String documentPrefix, String manifestKey, Integer id) {
        String key = documentPrefix + id;
        redisTemplate.delete(key);
        redisTemplate.opsForSet().remove(manifestKey, key);
    }

    private void replaceManifest(String manifestKey, Set<String> currentKeys) {
        if (currentKeys.isEmpty()) {
            redisTemplate.delete(manifestKey);
            return;
        }
        String temporaryKey = manifestKey + ":rebuild:" + UUID.randomUUID();
        redisTemplate.opsForSet().add(temporaryKey, currentKeys.toArray(String[]::new));
        redisTemplate.rename(temporaryKey, manifestKey);
    }

    private List<SearchCandidate> candidates(
            String index,
            String documentPrefix,
            String normalizedQuery,
            int requestedLimit
    ) {
        if (normalizedQuery == null || normalizedQuery.isBlank()) {
            return List.of();
        }

        int limit = Math.min(Math.max(requestedLimit, 1), 500);
        Map<Integer, SearchCandidate> unique = new LinkedHashMap<>();
        String tagQuery = escapeTag(normalizedQuery);

        addStage(unique, documentPrefix, MatchTier.EXACT,
                search(index, documentPrefix, "@normalized_exact:{" + tagQuery + "}", limit), limit);
        addStage(unique, documentPrefix, MatchTier.PREFIX,
                search(index, documentPrefix, "@normalized_exact:{" + tagQuery + "*}", limit), limit);

        if (normalizedQuery.length() >= 2 && unique.size() < limit) {
            addStage(unique, documentPrefix, MatchTier.FUZZY_1,
                    search(index, documentPrefix, "@normalized:(%" + normalizedQuery + "%)", limit), limit);
        }
        if (normalizedQuery.length() >= 2 && unique.size() < limit) {
            addStage(unique, documentPrefix, MatchTier.FUZZY_2,
                    search(index, documentPrefix, "@normalized:(%%" + normalizedQuery + "%%)", limit), limit);
        }
        if (unique.size() < limit) {
            addStage(unique, documentPrefix, MatchTier.CONTAINS,
                    search(index, documentPrefix, "@normalized_exact:{*" + tagQuery + "*}", limit), limit);
        }
        return unique.values().stream().limit(limit).toList();
    }

    private void addStage(
            Map<Integer, SearchCandidate> target,
            String documentPrefix,
            MatchTier tier,
            List<ScoredDocument> documents,
            int limit
    ) {
        for (ScoredDocument document : documents) {
            if (target.size() >= limit) {
                return;
            }
            Integer id = documentId(documentPrefix, document.key());
            if (id != null) {
                target.putIfAbsent(
                        id,
                        new SearchCandidate(id, tier, document.score(), target.size())
                );
            }
        }
    }

    private List<ScoredDocument> search(
            String index,
            String documentPrefix,
            String query,
            int limit
    ) {
        Object result = executeSearch(
                "FT.SEARCH",
                index,
                query,
                "NOCONTENT",
                "WITHSCORES",
                "LIMIT", "0", Integer.toString(limit),
                "TIMEOUT", Integer.toString(SEARCH_TIMEOUT_MILLIS),
                "DIALECT", "2"
        );
        List<ScoredDocument> documents = new ArrayList<>();
        collectScoredDocuments(
                result,
                documentPrefix,
                documents,
                new LinkedHashSet<>(),
                limit
        );
        return documents;
    }

    private void collectScoredDocuments(
            Object value,
            String documentPrefix,
            List<ScoredDocument> documents,
            Set<String> seen,
            int limit
    ) {
        if (documents.size() >= limit) {
            return;
        }
        if (value instanceof List<?> values) {
            for (int index = 0; index < values.size(); index++) {
                Object nested = values.get(index);
                String key = rawString(nested);
                if (key != null && key.startsWith(documentPrefix) && seen.add(key)) {
                    double score = scoreAfter(values, index);
                    documents.add(new ScoredDocument(key, score));
                } else {
                    collectScoredDocuments(
                            nested,
                            documentPrefix,
                            documents,
                            seen,
                            limit
                    );
                }
                if (documents.size() >= limit) {
                    return;
                }
            }
        }
    }

    private double scoreAfter(List<?> values, int keyIndex) {
        if (keyIndex + 1 < values.size()) {
            double direct = rawScore(values.get(keyIndex + 1));
            if (direct != 0) {
                return direct;
            }
        }
        for (int index = keyIndex + 1; index + 1 < values.size(); index++) {
            if ("score".equals(rawString(values.get(index)))) {
                return rawScore(values.get(index + 1));
            }
        }
        return 0;
    }

    private double rawScore(Object value) {
        String raw = rawString(value);
        if (raw != null) {
            try {
                return Double.parseDouble(raw);
            } catch (NumberFormatException ignored) {
                // Some Redis drivers wrap each result pair in a nested list.
            }
        }
        if (value instanceof List<?> values) {
            for (Object nested : values) {
                double score = rawScore(nested);
                if (score != 0) {
                    return score;
                }
            }
        }
        return 0;
    }

    private Integer documentId(String prefix, String key) {
        if (!key.startsWith(prefix)) {
            return null;
        }
        try {
            return Integer.valueOf(key.substring(prefix.length()));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String escapeTag(String value) {
        String reserved = "\\,.<>{}[]\"':;!@#$%^&*()-+=~|/ ";
        StringBuilder escaped = new StringBuilder(value.length());
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (reserved.indexOf(character) >= 0) {
                escaped.append('\\');
            }
            escaped.append(character);
        }
        return escaped.toString();
    }

    private Object execute(String command, String... arguments) {
        byte[][] rawArguments = new byte[arguments.length][];
        for (int index = 0; index < arguments.length; index++) {
            rawArguments[index] = bytes(arguments[index]);
        }
        try {
            return redisTemplate.execute(
                    (RedisCallback<Object>) connection ->
                            connection.execute(command, rawArguments)
            );
        } catch (BusinessException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            log.warn("Redis search command failed: {} {}", command, List.of(arguments), exception);
            throw new BusinessException(
                    ErrorCode.SERVICE_UNAVAILABLE,
                    "????? ??????????."
            );
        }
    }

    private Object executeSearch(String command, String... arguments) {
        byte[][] rawArguments = new byte[arguments.length][];
        for (int index = 0; index < arguments.length; index++) {
            rawArguments[index] = bytes(arguments[index]);
        }
        try {
            return redisTemplate.execute(
                    (RedisCallback<Object>) connection -> {
                        CommandArgs<byte[], byte[]> commandArgs =
                                new CommandArgs<>(ByteArrayCodec.INSTANCE);
                        for (byte[] rawArgument : rawArguments) {
                            commandArgs.add(rawArgument);
                        }

                        ProtocolKeyword keyword = new RawKeyword(command);
                        NestedMultiOutput<byte[], byte[]> output =
                                new NestedMultiOutput<>(ByteArrayCodec.INSTANCE);
                        Object nativeConnection = connection.getNativeConnection();

                        if (nativeConnection instanceof BaseRedisCommands<?, ?> commands) {
                            @SuppressWarnings("unchecked")
                            BaseRedisCommands<byte[], byte[]> typedCommands =
                                    (BaseRedisCommands<byte[], byte[]>) commands;
                            return typedCommands.dispatch(keyword, output, commandArgs);
                        }
                        if (nativeConnection instanceof BaseRedisAsyncCommands<?, ?> commands) {
                            @SuppressWarnings("unchecked")
                            BaseRedisAsyncCommands<byte[], byte[]> typedCommands =
                                    (BaseRedisAsyncCommands<byte[], byte[]>) commands;
                            try {
                                return typedCommands.dispatch(keyword, output, commandArgs)
                                        .get(5, TimeUnit.SECONDS);
                            } catch (InterruptedException exception) {
                                Thread.currentThread().interrupt();
                                throw new IllegalStateException(exception);
                            } catch (Exception exception) {
                                throw new IllegalStateException(exception);
                            }
                        }
                        throw new IllegalStateException(
                                "Unsupported Redis native connection: " + nativeConnection.getClass()
                        );
                    }
            );
        } catch (BusinessException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            log.warn("Redis search command failed: {} {}", command, List.of(arguments), exception);
            throw new BusinessException(
                    ErrorCode.SERVICE_UNAVAILABLE,
                    "????? ??????????."
            );
        }
    }

    private Set<String> rawStringSet(Object value) {
        if (!(value instanceof Collection<?> values)) {
            return Set.of();
        }
        Set<String> result = new LinkedHashSet<>();
        values.forEach(item -> {
            String converted = rawString(item);
            if (converted != null) {
                result.add(converted);
            }
        });
        return result;
    }

    private String rawString(Object value) {
        if (value instanceof byte[] bytes) {
            return new String(bytes, StandardCharsets.UTF_8);
        }
        return value == null ? null : value.toString();
    }

    private byte[] bytes(String value) {
        return value.getBytes(StandardCharsets.UTF_8);
    }

    public enum MatchTier {
        EXACT(1, 0),
        PREFIX(2, 0),
        FUZZY_1(3, 1),
        FUZZY_2(4, 2),
        CONTAINS(5, -1);

        private final int rank;
        private final int editDistance;

        MatchTier(int rank, int editDistance) {
            this.rank = rank;
            this.editDistance = editDistance;
        }

        public int rank() {
            return rank;
        }

        public int editDistance() {
            return editDistance;
        }
    }

    public record SearchCandidate(
            Integer targetSeq,
            MatchTier matchTier,
            double redisScore,
            int candidateOrder
    ) {
    }

    private record ScoredDocument(String key, double score) {
    }

    private record RawKeyword(String command) implements ProtocolKeyword {
        @Override
        public byte[] getBytes() {
            return command.getBytes(StandardCharsets.UTF_8);
        }

        @Override
        public String toString() {
            return command;
        }
    }
}
