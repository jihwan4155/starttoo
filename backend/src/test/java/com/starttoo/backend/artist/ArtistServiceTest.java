package com.starttoo.backend.artist;

import com.starttoo.backend.artist.api.ArtistDtos;
import com.starttoo.backend.artist.application.ArtistService;
import com.starttoo.backend.artist.domain.Artist;
import com.starttoo.backend.artist.domain.ArtistRepository;
import com.starttoo.backend.artist.domain.VerificationStatus;
import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.user.application.UserService;
import com.starttoo.backend.user.domain.AccountStatus;
import com.starttoo.backend.user.domain.User;
import com.starttoo.backend.user.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ArtistServiceTest {

    @Mock
    private ArtistRepository artistRepository;

    @Mock
    private UserService userService;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    @Mock
    private MediaService mediaService;

    @InjectMocks
    private ArtistService artistService;

    @Test
    void listFiltersUserRoleArtist() {
        when(jdbcTemplate.query(
                anyString(),
                any(org.springframework.jdbc.core.RowMapper.class),
                any(), any(), any(), any(), any(), any(), any()
        ))
                .thenReturn(List.of());

        artistService.list(null, 20, null);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).query(
                sql.capture(),
                any(org.springframework.jdbc.core.RowMapper.class),
                any(), any(), any(), any(), any(), any(), any()
        );
        assertThat(sql.getValue()).contains("u.role = 'ARTIST'");
    }

    @Test
    void updateRejectsArtistRoleWhenArtistProfileIsMissing() {
        User user = user(7, null);
        when(userService.find(7)).thenReturn(user);
        when(artistRepository.findActiveForUpdate(7)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> artistService.update(
                7,
                new ArtistDtos.UpdateArtistRequest(
                        "스타투 스튜디오",
                        "서울",
                        "서울특별시 강남구 테헤란로 1",
                        "02-1234-5678",
                        "예약제"
                )
        )).isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ARTIST_NOT_FOUND));
    }

    @Test
    void updatePreservesVerificationStatus() {
        User user = user(7, null);
        Artist artist = artist(VerificationStatus.VERIFIED);
        when(userService.find(7)).thenReturn(user);
        when(artistRepository.findActiveForUpdate(7)).thenReturn(Optional.of(artist));
        when(artistRepository.findByUserSeqAndDeletedFalse(7)).thenReturn(Optional.of(artist));
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(7))).thenReturn(3L);

        ArtistDtos.ArtistProfile profile = artistService.update(
                7,
                new ArtistDtos.UpdateArtistRequest("새 숍", "부산", null, null, null)
        );

        assertThat(profile.verificationStatus()).isEqualTo(VerificationStatus.VERIFIED);
        assertThat(artist.getVerificationStatus()).isEqualTo(VerificationStatus.VERIFIED);
    }

    @Test
    void verifyChangesUnverifiedArtistToVerified() {
        Artist artist = artist(VerificationStatus.UNVERIFIED);
        when(userService.find(7)).thenReturn(user(7, null));
        when(artistRepository.findActiveForUpdate(7)).thenReturn(Optional.of(artist));
        when(artistRepository.findByUserSeqAndDeletedFalse(7)).thenReturn(Optional.of(artist));
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(7))).thenReturn(0L);

        ArtistDtos.ArtistProfile profile = artistService.verify(7);

        assertThat(profile.verificationStatus()).isEqualTo(VerificationStatus.VERIFIED);
        assertThat(artist.getVerificationStatus()).isEqualTo(VerificationStatus.VERIFIED);
        assertThat(artist.getVerificationProcessedUsrSeq()).isEqualTo(7);
        assertThat(artist.getVerificationProcessedDttm()).isNotNull();
    }

    @Test
    void verifyRejectsAlreadyVerifiedArtist() {
        Artist artist = artist(VerificationStatus.VERIFIED);
        when(userService.find(7)).thenReturn(user(7, null));
        when(artistRepository.findActiveForUpdate(7)).thenReturn(Optional.of(artist));

        assertThatThrownBy(() -> artistService.verify(7))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.STATE_CONFLICT));
        assertThat(artist.getVerificationProcessedUsrSeq()).isNull();
    }

    @Test
    void verifyRejectsNonArtistRole() {
        OffsetDateTime now = OffsetDateTime.now();
        User user = User.builder()
                .userSeq(7)
                .nickname("일반회원")
                .phoneNumber("+821012345678")
                .phoneVerifiedDttm(now)
                .role(UserRole.USER)
                .recentSearchTerms(new String[0])
                .accountStatus(AccountStatus.ACTIVE)
                .statusChangedDttm(now)
                .regDttm(now)
                .modDttm(now)
                .deleted(false)
                .build();
        when(userService.find(7)).thenReturn(user);

        assertThatThrownBy(() -> artistService.verify(7))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.FORBIDDEN));
        verify(artistRepository, org.mockito.Mockito.never()).findActiveForUpdate(any());
    }

    @Test
    void profileImageUrlIsPresignedFromObjectKey() {
        Artist artist = artist(VerificationStatus.VERIFIED);
        when(artistRepository.findActiveForUpdate(7)).thenReturn(Optional.of(artist));
        when(artistRepository.findByUserSeqAndDeletedFalse(7)).thenReturn(Optional.of(artist));
        when(userService.find(7)).thenReturn(user(7, 301L));
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(7))).thenReturn(5L);
        when(jdbcTemplate.queryForList(anyString(), eq(String.class), eq(301L)))
                .thenReturn(List.of("profiles/7/image.png"));
        when(mediaService.downloadUrl("profiles/7/image.png"))
                .thenReturn("https://temporary-download-url");

        ArtistDtos.ArtistProfile profile = artistService.update(
                7,
                new ArtistDtos.UpdateArtistRequest("숍", "서울", null, null, null)
        );

        assertThat(profile.profileImageSeq()).isEqualTo(301L);
        assertThat(profile.profileImageUrl()).isEqualTo("https://temporary-download-url");
    }

    private Artist artist(VerificationStatus status) {
        OffsetDateTime now = OffsetDateTime.now();
        return Artist.builder()
                .userSeq(7)
                .verificationStatus(status)
                .regDttm(now)
                .modDttm(now)
                .modUsrSeq(7)
                .deleted(false)
                .build();
    }

    private User user(Integer userSeq, Long profileImageSeq) {
        OffsetDateTime now = OffsetDateTime.now();
        return User.builder()
                .userSeq(userSeq)
                .nickname("검은장미")
                .phoneNumber("+821012345678")
                .phoneVerifiedDttm(now)
                .profileImageSeq(profileImageSeq)
                .role(UserRole.ARTIST)
                .recentSearchTerms(new String[0])
                .accountStatus(AccountStatus.ACTIVE)
                .statusChangedDttm(now)
                .regDttm(now)
                .modDttm(now)
                .deleted(false)
                .build();
    }
}
