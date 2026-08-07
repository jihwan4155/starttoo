package com.starttoo.backend.collection;

import com.starttoo.backend.collection.application.CollectionService;
import com.starttoo.backend.collection.application.CollectionWriteService;
import com.starttoo.backend.collection.api.CollectionDtos;
import com.starttoo.backend.collection.config.CollectionProperties;
import com.starttoo.backend.collection.domain.TattooCollection;
import com.starttoo.backend.collection.domain.TattooCollectionRepository;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.media.domain.ImageRepository;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.tattoo.domain.TattooDesignRepository;
import com.starttoo.backend.tattoo.domain.TattooRepository;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.User;
import com.starttoo.backend.user.domain.UserRepository;
import com.starttoo.backend.user.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CollectionServiceTest {

    private static final int ARCHIVE_MAX_DESIGNS = 20;

    /** CollectionService.ARCHIVE_LOCK_NAMESPACE ('ARCH') 와 같은 값이어야 한다. */
    private static final int ARCHIVE_LOCK_NAMESPACE = 0x41524348;

    @Mock
    private TattooCollectionRepository collectionRepository;

    @Mock
    private TattooRepository tattooRepository;

    @Mock
    private TattooDesignRepository tattooDesignRepository;

    @Mock
    private CollectionWriteService collectionWriteService;

    @Mock
    private PreferenceScoreService preferenceScoreService;

    @Mock
    private ImageRepository imageRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    @Mock
    private MediaService mediaService;

    @Mock
    private CollectionProperties collectionProperties;

    @InjectMocks
    private CollectionService collectionService;

    @Test
    void nonArchiveDesignIsRejectedWithoutCollectionWrite() {
        CollectionDtos.CreateCollectionRequest request = request();
        when(tattooDesignRepository.findByImageSeqAndDeletedFalse(301L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> collectionService.create(1, request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.STATE_CONFLICT));

        verify(collectionWriteService, never()).create(
                any(), any(), any(), any(), any(), any(Boolean.class)
        );
        verifyNoInteractions(preferenceScoreService);
    }

    @Test
    void blockedPublicCollectionOwnerIsHidden() {
        when(userRepository.findByUserSeqAndDeletedFalse(8))
                .thenReturn(Optional.of(activeUser(8)));
        when(jdbcTemplate.queryForObject(
                contains("FROM user_blocks"),
                eq(Boolean.class),
                eq(7), eq(8), eq(8), eq(7)
        )).thenReturn(true);

        assertThatThrownBy(() -> collectionService.byUser(8, 7, null, 20))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.USER_NOT_FOUND));

        verify(namedParameterJdbcTemplate, never()).query(
                anyString(),
                any(SqlParameterSource.class),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any()
        );
    }

    @Test
    void listReturnsOwnerAndPresignedOriginalImageUrl() throws Exception {
        doAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(2);
            ResultSet resultSet = org.mockito.Mockito.mock(ResultSet.class);
            when(resultSet.getLong("collection_seq")).thenReturn(601L);
            when(resultSet.getInt("owner_seq")).thenReturn(7);
            when(resultSet.getLong("tattoo_seq")).thenReturn(501L);
            when(resultSet.getLong("image_seq")).thenReturn(301L);
            when(resultSet.getString("image_object_key"))
                    .thenReturn("users/7/collection/original.png");
            when(resultSet.getString("body_view")).thenReturn("front");
            when(resultSet.getDouble("position_x")).thenReturn(0.42);
            when(resultSet.getDouble("position_y")).thenReturn(0.35);
            when(resultSet.getDouble("scale_ratio")).thenReturn(0.8);
            when(resultSet.getDouble("rotation_degree")).thenReturn(-15.0);
            when(resultSet.getBoolean("is_flipped")).thenReturn(false);
            when(resultSet.getObject("reg_dttm", OffsetDateTime.class))
                    .thenReturn(OffsetDateTime.parse("2026-07-30T01:30:00Z"));
            return List.of(mapper.mapRow(resultSet, 0));
        }).when(namedParameterJdbcTemplate).query(
                anyString(),
                any(SqlParameterSource.class),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any()
        );
        when(mediaService.downloadUrl("users/7/collection/original.png"))
                .thenReturn("https://minio.example/collection");

        CursorPageResponse<CollectionDtos.CollectionResponse> response =
                collectionService.list(7, null, 20);

        assertThat(response.items()).singleElement().satisfies(item -> {
            assertThat(item.ownerSeq()).isEqualTo(7);
            assertThat(item.imageSeq()).isEqualTo(301L);
            assertThat(item.imageUrl()).isEqualTo("https://minio.example/collection");
        });
    }

    @Test
    void deleteSoftDeletesCollectionOnlyWithoutReversingScore() {
        TattooCollection collection = collection(601L, 7, 501L);
        when(collectionRepository.findByCollectionSeqAndUserSeqAndDeletedFalse(601L, 7))
                .thenReturn(Optional.of(collection));

        collectionService.delete(7, 601L);

        assertThat(collection.isDeleted()).isTrue();
        verifyNoInteractions(tattooRepository);
        verifyNoInteractions(preferenceScoreService);
        verifyNoInteractions(imageRepository);
    }

    @Test
    void savingNonDesignTattooReturnsStateConflict() {
        archived(false);
        full(false);
        when(jdbcTemplate.update(anyString(), eq(1), eq(501L))).thenReturn(0);

        assertThatThrownBy(() -> collectionService.setArchive(1, 501L, true))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATE_CONFLICT);

        verify(preferenceScoreService, never()).applyCollection(any(), any(), any(Boolean.class));
    }

    @Test
    void repeatedSaveDoesNotChangePreferenceScoreAgain() {
        archived(true);

        collectionService.setArchive(1, 501L, true);

        verify(jdbcTemplate, never()).update(contains("INSERT INTO user_archive"), any(), any());
        verify(preferenceScoreService, never()).applyCollection(any(), any(), any(Boolean.class));
    }

    @Test
    void savingBeyondArchiveLimitIsRejectedBeforeInsert() {
        archived(false);
        full(true);

        assertThatThrownBy(() -> collectionService.setArchive(1, 501L, true))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.ARCHIVE_LIMIT_EXCEEDED);

        verify(jdbcTemplate, never()).update(contains("INSERT INTO user_archive"), any(), any());
        verify(preferenceScoreService, never()).applyCollection(any(), any(), any(Boolean.class));
    }

    @Test
    void archiveCountIsReadOnlyAfterLockingTheUser() {
        archived(false);
        full(true);

        assertThatThrownBy(() -> collectionService.setArchive(1, 501L, true))
                .isInstanceOf(BusinessException.class);

        // 잠그지 않고 세면 동시 요청이 같은 개수를 보고 둘 다 통과해 상한을 넘긴다.
        InOrder order = inOrder(jdbcTemplate);
        order.verify(jdbcTemplate).query(
                contains("pg_advisory_xact_lock"),
                org.mockito.ArgumentMatchers.<ResultSetExtractor<Object>>any(),
                eq(ARCHIVE_LOCK_NAMESPACE),
                eq(1)
        );
        order.verify(jdbcTemplate).queryForObject(
                contains("COUNT(*)"),
                eq(Boolean.class),
                eq(ARCHIVE_MAX_DESIGNS),
                eq(1)
        );
    }

    @Test
    void repeatedSaveAtArchiveLimitStillSucceeds() {
        archived(true);

        assertThat(collectionService.setArchive(1, 501L, true)).isTrue();

        // 이미 담긴 도안은 보관 수를 늘리지 않으므로 상한을 따지지 않는다.
        verify(jdbcTemplate, never())
                .queryForObject(contains("COUNT(*)"), eq(Boolean.class), any(), any());
    }

    private void archived(boolean value) {
        when(jdbcTemplate.queryForObject(
                contains("SELECT EXISTS"),
                eq(Boolean.class),
                eq(1),
                eq(501L)
        )).thenReturn(value);
    }

    private void full(boolean value) {
        when(collectionProperties.archiveMaxDesigns()).thenReturn(ARCHIVE_MAX_DESIGNS);
        when(jdbcTemplate.queryForObject(
                contains("COUNT(*)"),
                eq(Boolean.class),
                eq(ARCHIVE_MAX_DESIGNS),
                eq(1)
        )).thenReturn(value);
    }

    @Test
    void repeatedDeleteDoesNotChangePreferenceScoreAgain() {
        when(jdbcTemplate.update(anyString(), eq(1), eq(501L))).thenReturn(0);

        collectionService.setArchive(1, 501L, false);

        verify(preferenceScoreService, never()).applyCollection(any(), any(), any(Boolean.class));
    }

    private CollectionDtos.CreateCollectionRequest request() {
        return new CollectionDtos.CreateCollectionRequest(
                301L,
                "front",
                0.42,
                0.35,
                0.8,
                -15.0,
                false
        );
    }

    private User activeUser(Integer userSeq) {
        OffsetDateTime now = OffsetDateTime.now();
        return User.builder()
                .userSeq(userSeq)
                .nickname("검은장미")
                .phoneNumber("+821012345678")
                .phoneVerifiedDttm(now)
                .role(UserRole.USER)
                .recentSearchTerms(new String[0])
                .accountStatus(AccountStatus.ACTIVE)
                .statusChangedDttm(now)
                .regDttm(now)
                .modDttm(now)
                .modUsrSeq(userSeq)
                .deleted(false)
                .build();
    }

    private TattooCollection collection(Long collectionSeq, Integer userSeq, Long tattooSeq) {
        OffsetDateTime now = OffsetDateTime.now();
        return TattooCollection.builder()
                .collectionSeq(collectionSeq)
                .userSeq(userSeq)
                .tattooSeq(tattooSeq)
                .bodyView("front")
                .positionX(0.42)
                .positionY(0.35)
                .scaleRatio(0.8)
                .rotationDegree(-15)
                .flipped(false)
                .regDttm(now)
                .modDttm(now)
                .deleted(false)
                .build();
    }
}
