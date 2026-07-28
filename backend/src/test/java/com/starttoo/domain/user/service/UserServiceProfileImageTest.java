package com.starttoo.domain.user.service;

import com.starttoo.common.pagination.CursorCodec;
import com.starttoo.config.properties.ProfileImageProperties;
import com.starttoo.domain.artist.repository.TattooArtistRepository;
import com.starttoo.domain.auth.service.RefreshTokenService;
import com.starttoo.domain.image.service.ImageReferenceService;
import com.starttoo.domain.image.service.ObjectStoragePort;
import com.starttoo.domain.search.repository.UserRecentSearchRepository;
import com.starttoo.domain.social.repository.UserBlockRepository;
import com.starttoo.domain.social.repository.UserFollowRepository;
import com.starttoo.domain.tattoo.repository.TattooCollectionRepository;
import com.starttoo.domain.tattoo.repository.TattooRepository;
import com.starttoo.domain.user.dto.UserDtos.ProfileImageRequest;
import com.starttoo.domain.user.entity.UserEntity;
import com.starttoo.domain.user.repository.UserDeviceRepository;
import com.starttoo.domain.user.repository.UserRepository;
import com.starttoo.domain.user.repository.UserTattooPreferenceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceProfileImageTest {

    @Mock private UserRepository userRepository;
    @Mock private TattooArtistRepository artistRepository;
    @Mock private UserFollowRepository followRepository;
    @Mock private UserBlockRepository blockRepository;
    @Mock private UserDeviceRepository deviceRepository;
    @Mock private UserRecentSearchRepository recentSearchRepository;
    @Mock private TattooCollectionRepository collectionRepository;
    @Mock private TattooRepository tattooRepository;
    @Mock private UserTattooPreferenceRepository preferenceRepository;
    @Mock private ImageReferenceService imageReferenceService;
    @Mock private ObjectStoragePort objectStoragePort;
    @Mock private RefreshTokenService refreshTokenService;
    @Mock private ProfileImageProperties profileImageProperties;
    @Mock private CursorCodec cursorCodec;

    @InjectMocks
    private UserService userService;

    @Test
    void updatesProfileImageWithoutRegisteringImagesRow() {
        UserEntity user = activeUser("users/101/profile/old.webp");
        String newObjectKey = "users/101/profile/new.webp";
        when(userRepository.findById(101L)).thenReturn(Optional.of(user));
        when(objectStoragePort.createDownloadUrl(newObjectKey)).thenReturn("https://storage.example/profile");

        var response = userService.updateProfileImage(101L, new ProfileImageRequest(newObjectKey));

        assertThat(user.getProfileImageKey()).isEqualTo(newObjectKey);
        assertThat(response.profileImageUrl()).isEqualTo("https://storage.example/profile");
        verify(objectStoragePort).verifyUploadedObject(newObjectKey, 101L);
        verify(objectStoragePort).createDownloadUrl(newObjectKey);
        verifyNoInteractions(imageReferenceService);
    }

    @Test
    void resetsProfileImageToSharedDefaultWithoutTouchingImagesTable() {
        UserEntity user = activeUser("users/101/profile/old.webp");
        when(userRepository.findById(101L)).thenReturn(Optional.of(user));
        when(profileImageProperties.getDefaultImageKey())
                .thenReturn("system/profile/default-profile.webp");

        userService.removeProfileImage(101L);

        assertThat(user.getProfileImageKey()).isEqualTo("system/profile/default-profile.webp");
        verifyNoInteractions(imageReferenceService, objectStoragePort);
    }

    private UserEntity activeUser(String profileImageKey) {
        return UserEntity.builder()
                .userId(101L)
                .oauthProvider("GOOGLE")
                .oauthSubject("oauth-subject")
                .nickname("needlemoon")
                .profileImageKey(profileImageKey)
                .role("USER")
                .accountStatus("ACTIVE")
                .build();
    }
}
