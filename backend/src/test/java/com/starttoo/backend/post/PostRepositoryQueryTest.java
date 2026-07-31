package com.starttoo.backend.post;

import com.starttoo.backend.post.domain.PostRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.lang.reflect.Method;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class PostRepositoryQueryTest {

    @Test
    void contentUpdateDoesNotWriteCounterColumns() throws Exception {
        Query query = method(
                "updateContent",
                Long.class,
                Integer.class,
                String.class,
                Integer.class,
                OffsetDateTime.class
        ).getAnnotation(Query.class);

        assertThat(query.value())
                .contains("p.content", "p.modUsrSeq", "p.modDttm")
                .doesNotContain("p.likeCount", "p.commentCount", "p.reportCount");
        assertClearsPersistenceContext("updateContent");
    }

    @Test
    void softDeleteDoesNotWriteCounterColumns() throws Exception {
        Query query = method(
                "softDelete",
                Long.class,
                Integer.class,
                Integer.class,
                OffsetDateTime.class
        ).getAnnotation(Query.class);

        assertThat(query.value())
                .contains("p.postStatus", "p.deleted", "p.modUsrSeq", "p.modDttm")
                .doesNotContain("p.likeCount", "p.commentCount", "p.reportCount");
        assertClearsPersistenceContext("softDelete");
    }

    private void assertClearsPersistenceContext(String methodName) {
        Method method = java.util.Arrays.stream(PostRepository.class.getDeclaredMethods())
                .filter(candidate -> candidate.getName().equals(methodName))
                .findFirst()
                .orElseThrow();
        Modifying modifying = method.getAnnotation(Modifying.class);
        assertThat(modifying.clearAutomatically()).isTrue();
        assertThat(modifying.flushAutomatically()).isTrue();
    }

    private Method method(String name, Class<?>... parameterTypes) throws Exception {
        return PostRepository.class.getMethod(name, parameterTypes);
    }
}
