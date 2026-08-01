package com.starttoo.backend.user;

import com.starttoo.backend.artist.domain.Artist;
import com.starttoo.backend.artist.domain.ArtistRepository;
import com.starttoo.backend.artist.domain.VerificationStatus;
import com.starttoo.backend.common.api.CursorPageResponse;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.media.domain.Image;
import com.starttoo.backend.media.domain.ImageRepository;
import com.starttoo.backend.search.application.SearchIndexEventPublisher;
import com.starttoo.backend.user.api.UserDtos;
import com.starttoo.backend.user.application.UserService;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.User;
import com.starttoo.backend.user.domain.UserRepository;
import com.starttoo.backend.user.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private ArtistRepository artistRepository;

    @Mock
    private ImageRepository imageRepository;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    @Mock
    private MediaService mediaService;

    @Mock
    private SearchIndexEventPublisher searchIndexEventPublisher;

    @InjectMocks
    private UserService userService;

    @Test
    void artistMeIncludesArtistProfileAndPresignedProfileImage() {
        User artistUser = user(7, UserRole.ARTIST);
        when(userRepository.findByUserSeqAndDeletedFalse(7))
                .thenReturn(Optional.of(artistUser));
        when(imageRepository.findByImageSeqAndDeletedFalse(301L))
                .thenReturn(Optional.of(image(301L, "users/7/profile/profile.png", 7)));
        when(mediaService.downloadUrl("users/7/profile/profile.png"))
                .thenReturn("https://minio.example/profile");
        when(artistRepository.findByUserSeqAndDeletedFalse(7))
                .thenReturn(Optional.of(artist(7, VerificationStatus.VERIFIED)));

        UserDtos.MyProfile response = userService.me(7);

        assertThat(response.role()).isEqualTo(UserRole.ARTIST);
        assertThat(response.profileImageUrl()).isEqualTo("https://minio.example/profile");
        assertThat(response.artistProfile()).isNotNull();
        assertThat(response.artistProfile().shopName()).isEqualTo("스타투 스튜디오");
        assertThat(response.artistProfile().verificationStatus())
                .isEqualTo(VerificationStatus.VERIFIED);
    }

    @Test
    void regularUserMeDoesNotIncludeArtistProfile() {
        User regularUser = user(7, UserRole.USER);
        when(userRepository.findByUserSeqAndDeletedFalse(7))
                .thenReturn(Optional.of(regularUser));
        when(imageRepository.findByImageSeqAndDeletedFalse(301L))
                .thenReturn(Optional.of(image(301L, "users/7/profile/profile.png", 7)));
        when(mediaService.downloadUrl("users/7/profile/profile.png"))
                .thenReturn("https://minio.example/profile");

        UserDtos.MyProfile response = userService.me(7);

        assertThat(response.artistProfile()).isNull();
        verify(artistRepository, never()).findByUserSeqAndDeletedFalse(any());
    }

    @Test
    void profileImageMustBeOwnedAndUploadedForProfilePurpose() {
        User user = user(7, UserRole.USER);
        when(userRepository.findActiveForUpdate(7)).thenReturn(Optional.of(user));
        when(imageRepository.findByImageSeqAndDeletedFalse(302L))
                .thenReturn(Optional.of(image(302L, "users/7/post/post.png", 7)));

        assertThatThrownBy(() -> userService.replaceProfileImage(7, 302L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.IMAGE_NOT_FOUND));

        verify(searchIndexEventPublisher, never()).accountChanged(any());
    }

    @Test
    void nicknameChangePublishesSearchIndexEvent() {
        User user = user(7, UserRole.USER);
        when(userRepository.findActiveForUpdate(7)).thenReturn(Optional.of(user));
        when(userRepository.findByUserSeqAndDeletedFalse(7)).thenReturn(Optional.of(user));
        when(userRepository.existsByNicknameAndAccountStatusNotAndDeletedFalse(
                "BlackRose1",
                AccountStatus.WITHDRAWN
        )).thenReturn(false);
        when(imageRepository.findByImageSeqAndDeletedFalse(301L))
                .thenReturn(Optional.of(image(301L, "users/7/profile/profile.png", 7)));
        when(mediaService.downloadUrl("users/7/profile/profile.png"))
                .thenReturn("https://minio.example/profile");

        UserDtos.MyProfile response = userService.update(
                7,
                new UserDtos.UpdateProfileRequest(
                        "BlackRose1",
                        LocalDate.of(1998, 5, 21),
                        "F"
                )
        );

        assertThat(response.nickname()).isEqualTo("BlackRose1");
        verify(searchIndexEventPublisher).accountChanged(7);
    }

    @Test
    void newFollowCreatesRelationWithoutServiceNotification() {
        when(userRepository.findByUserSeqAndDeletedFalse(8))
                .thenReturn(Optional.of(user(8, UserRole.USER)));
        when(jdbcTemplate.queryForObject(
                contains("FROM user_blocks"),
                eq(Boolean.class),
                eq(7), eq(8), eq(8), eq(7)
        )).thenReturn(false);
        when(jdbcTemplate.update(
                contains("INSERT INTO user_follows"),
                eq(7),
                eq(8)
        )).thenReturn(1);

        assertThat(userService.setFollow(7, 8, true)).isTrue();

        verify(jdbcTemplate).update(
                contains("INSERT INTO user_follows"),
                eq(7),
                eq(8)
        );
    }

    @Test
    void enablingBlockDeletesBothFollowDirections() {
        when(userRepository.findByUserSeqAndDeletedFalse(8))
                .thenReturn(Optional.of(user(8, UserRole.USER)));

        assertThat(userService.setBlock(7, 8, true)).isTrue();

        verify(jdbcTemplate).update(
                contains("INSERT INTO user_blocks"),
                eq(7),
                eq(8)
        );
        verify(jdbcTemplate).update(
                contains("DELETE FROM user_follows"),
                eq(7), eq(8), eq(8), eq(7)
        );
    }

    @Test
    void relationListFiltersInactiveDeletedAndAdminUsers() {
        when(userRepository.findByUserSeqAndDeletedFalse(8))
                .thenReturn(Optional.of(user(8, UserRole.USER)));
        when(namedParameterJdbcTemplate.query(
                anyString(),
                any(SqlParameterSource.class),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any()
        )).thenReturn(List.of());

        CursorPageResponse<UserDtos.RelationUser> response =
                userService.followers(8, null, null, 20);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(namedParameterJdbcTemplate).query(
                sql.capture(),
                any(SqlParameterSource.class),
                org.mockito.ArgumentMatchers.<RowMapper<Object>>any()
        );
        assertThat(sql.getValue()).contains(
                "related.account_status = 'ACTIVE'",
                "related.role <> 'ADMIN'",
                "related.is_deleted = FALSE",
                "ORDER BY relation.reg_dttm DESC, related.user_seq DESC"
        );
        assertThat(response.items()).isEmpty();
    }

    @Test
    void withdrawalRevokesRefreshTokensAndDeactivatesAllDevices() {
        User user = user(7, UserRole.USER);
        when(userRepository.findActiveForUpdate(7)).thenReturn(Optional.of(user));

        userService.withdraw(7);

        verify(jdbcTemplate).update(
                contains("UPDATE refresh_tokens"),
                eq(7)
        );
        verify(jdbcTemplate).update(
                contains("UPDATE user_devices"),
                eq(7)
        );
        assertThat(user.getAccountStatus()).isEqualTo(AccountStatus.WITHDRAWN);
        verify(searchIndexEventPublisher).accountChanged(7);
    }

    private User user(Integer userSeq, UserRole role) {
        OffsetDateTime now = OffsetDateTime.now();
        return User.builder()
                .userSeq(userSeq)
                .nickname("검은장미")
                .phoneNumber("+821012345678")
                .phoneVerifiedDttm(now)
                .profileImageSeq(301L)
                .birthDate(LocalDate.of(1998, 5, 21))
                .gender("M")
                .role(role)
                .recentSearchTerms(new String[0])
                .accountStatus(AccountStatus.ACTIVE)
                .statusChangedDttm(now)
                .regDttm(now)
                .modDttm(now)
                .modUsrSeq(userSeq)
                .deleted(false)
                .build();
    }

    private Image image(Long imageSeq, String objectKey, Integer ownerSeq) {
        OffsetDateTime now = OffsetDateTime.now();
        return Image.builder()
                .imageSeq(imageSeq)
                .objectKey(objectKey)
                .regDttm(now)
                .regUsrSeq(ownerSeq)
                .modDttm(now)
                .modUsrSeq(ownerSeq)
                .deleted(false)
                .build();
    }

    private Artist artist(Integer userSeq, VerificationStatus status) {
        OffsetDateTime now = OffsetDateTime.now();
        return Artist.builder()
                .userSeq(userSeq)
                .shopName("스타투 스튜디오")
                .verificationStatus(status)
                .regDttm(now)
                .modDttm(now)
                .modUsrSeq(userSeq)
                .deleted(false)
                .build();
    }
}
