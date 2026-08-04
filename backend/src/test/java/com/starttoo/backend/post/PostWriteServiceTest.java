package com.starttoo.backend.post;

import com.starttoo.backend.post.api.PostDtos;
import com.starttoo.backend.post.application.PostWriteService;
import com.starttoo.backend.post.domain.ClassificationStatus;
import com.starttoo.backend.post.domain.Post;
import com.starttoo.backend.post.domain.PostImage;
import com.starttoo.backend.post.domain.PostImageRepository;
import com.starttoo.backend.post.domain.PostRepository;
import com.starttoo.backend.post.domain.PostStatus;
import com.starttoo.backend.tattoo.application.TattooService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PostWriteServiceTest {

    @Mock
    private PostRepository postRepository;
    @Mock
    private PostImageRepository postImageRepository;

    @InjectMocks
    private PostWriteService postWriteService;

    @Test
    void persistsPostImagesInRequestOrderWithoutTattooRows() {
        var first = new TattooService.PreparedPostImage(61L, "object-61");
        var second = new TattooService.PreparedPostImage(62L, "object-62");
        when(postRepository.save(any(Post.class))).thenReturn(post(31L));

        Post created = postWriteService.create(
                7,
                new PostDtos.CreatePostRequest("content", List.of(61L, 62L)),
                List.of(first, second)
        );

        assertThat(created.getPostSeq()).isEqualTo(31L);
        ArgumentCaptor<PostImage> images = ArgumentCaptor.forClass(PostImage.class);
        verify(postImageRepository, org.mockito.Mockito.times(2)).save(images.capture());
        assertThat(images.getAllValues())
                .extracting(PostImage::getImageSeq, PostImage::getDisplayOrder)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(61L, (short) 1),
                        org.assertj.core.groups.Tuple.tuple(62L, (short) 2)
                );
    }

    @Test
    void marksEveryPostImagePendingSoBackfillCanRecoverIt() {
        when(postRepository.save(any(Post.class))).thenReturn(post(31L));

        postWriteService.create(
                7,
                new PostDtos.CreatePostRequest("content", List.of(61L, 62L)),
                List.of(
                        new TattooService.PreparedPostImage(61L, "object-61"),
                        new TattooService.PreparedPostImage(62L, "object-62")
                )
        );

        ArgumentCaptor<PostImage> images = ArgumentCaptor.forClass(PostImage.class);
        verify(postImageRepository, org.mockito.Mockito.times(2)).save(images.capture());
        // 게시물과 같은 트랜잭션에서 PENDING 이 커밋되어야 비동기 워커가 유실돼도 복구된다.
        assertThat(images.getAllValues())
                .extracting(PostImage::getClassificationStatus)
                .containsOnly(ClassificationStatus.PENDING);
        assertThat(images.getAllValues())
                .extracting(PostImage::getClassificationAttemptCount)
                .containsOnly((short) 0);
    }

    private Post post(Long postSeq) {
        OffsetDateTime now = OffsetDateTime.now();
        return Post.builder()
                .postSeq(postSeq)
                .authorSeq(7)
                .postStatus(PostStatus.PUBLISHED)
                .regDttm(now)
                .modDttm(now)
                .modUsrSeq(7)
                .build();
    }
}
