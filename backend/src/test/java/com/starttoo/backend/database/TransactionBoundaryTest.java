package com.starttoo.backend.database;

import com.starttoo.backend.admin.application.AdminService;
import com.starttoo.backend.artist.application.ArtistService;
import com.starttoo.backend.auth.application.AuthService;
import com.starttoo.backend.collection.application.CollectionService;
import com.starttoo.backend.comment.application.CommentService;
import com.starttoo.backend.dm.application.DmService;
import com.starttoo.backend.media.application.MediaService;
import com.starttoo.backend.notification.application.DeviceService;
import com.starttoo.backend.notification.application.NotificationService;
import com.starttoo.backend.post.application.PostService;
import com.starttoo.backend.preference.application.PreferenceScoreService;
import com.starttoo.backend.search.application.SearchService;
import com.starttoo.backend.tattoo.application.TattooService;
import com.starttoo.backend.user.application.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TransactionBoundaryTest {

    @Test
    void multiWriteUseCasesHaveOneWritableTransactionBoundary() {
        List<MethodRef> methods = List.of(
                ref(AuthService.class, "signup"),
                ref(AuthService.class, "refresh"),
                ref(AuthService.class, "logout"),
                ref(UserService.class, "update"),
                ref(UserService.class, "withdraw"),
                ref(UserService.class, "setFollow"),
                ref(UserService.class, "setBlock"),
                ref(ArtistService.class, "decide"),
                ref(AdminService.class, "changeAccountStatus"),
                ref(AdminService.class, "decideReport"),
                ref(AdminService.class, "restoreExpiredSuspensions"),
                ref(TattooService.class, "process"),
                ref(PostService.class, "create"),
                ref(PostService.class, "setLike"),
                ref(PostService.class, "setBookmark"),
                ref(PostService.class, "setNotInterested"),
                ref(PostService.class, "recordDwell"),
                ref(PostService.class, "report"),
                ref(CommentService.class, "create"),
                ref(CommentService.class, "delete"),
                ref(CommentService.class, "setLike"),
                ref(CollectionService.class, "create"),
                ref(CollectionService.class, "delete"),
                ref(CollectionService.class, "setArchive"),
                ref(PreferenceScoreService.class, "survey"),
                ref(SearchService.class, "recordPostSearchClick"),
                ref(DmService.class, "createRoom"),
                ref(DmService.class, "send"),
                ref(DmService.class, "markRead"),
                ref(DmService.class, "leave"),
                ref(DmService.class, "notification"),
                ref(DmService.class, "deleteMessage"),
                ref(MediaService.class, "complete"),
                ref(DeviceService.class, "register"),
                ref(DeviceService.class, "deactivate"),
                ref(DeviceService.class, "deactivateForLogout"),
                ref(DeviceService.class, "deactivateInvalidPushTokens"),
                ref(NotificationService.class, "create"),
                ref(NotificationService.class, "read"),
                ref(NotificationService.class, "readAll"),
                ref(NotificationService.class, "readDmRoom")
        );

        assertThat(methods).allSatisfy(reference -> {
            Method method = java.util.Arrays.stream(reference.type().getDeclaredMethods())
                    .filter(candidate -> candidate.getName().equals(reference.methodName()))
                    .findFirst()
                    .orElseThrow();
            Transactional transactional = method.getAnnotation(Transactional.class);
            assertThat(transactional)
                    .as("%s#%s transaction boundary",
                            reference.type().getSimpleName(),
                            reference.methodName())
                    .isNotNull();
            assertThat(transactional.readOnly())
                    .as("%s#%s must be writable",
                            reference.type().getSimpleName(),
                            reference.methodName())
                    .isFalse();
        });
    }

    private MethodRef ref(Class<?> type, String methodName) {
        return new MethodRef(type, methodName);
    }

    private record MethodRef(Class<?> type, String methodName) {
    }
}
