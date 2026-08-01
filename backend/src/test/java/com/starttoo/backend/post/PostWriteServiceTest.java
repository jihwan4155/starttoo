package com.starttoo.backend.post;

import com.starttoo.backend.post.api.PostDtos;
import com.starttoo.backend.post.application.PostWriteService;
import com.starttoo.backend.post.domain.Post;
import com.starttoo.backend.post.domain.PostImage;
import com.starttoo.backend.post.domain.PostImageRepository;
import com.starttoo.backend.post.domain.PostRepository;
import com.starttoo.backend.post.domain.PostStatus;
import com.starttoo.backend.tattoo.application.TattooService;
import com.starttoo.backend.tattoo.domain.Tattoo;
import com.starttoo.backend.tattoo.domain.TattooSourceType;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PostWriteServiceTest {

    @Mock
    private PostRepository postRepository;
    @Mock
    private PostImageRepository postImageRepository;
    @Mock
    private TattooService tattooService;

    @InjectMocks
    private PostWriteService postWriteService;

    @Test
    void persistsOnlyTattooRowsButKeepsAllPostImagesInRequestOrder() {
        var analysis = new com.starttoo.backend.tattoo.application.TattooModelClient.Analysis(
                "OTHER", List.of(), List.of("LINE"), "BLACK", List.of("타투")
        );
        var first = new TattooService.PreparedPostImage(61L, "object-61", analysis);
        var second = new TattooService.PreparedPostImage(62L, "object-62", null);
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
        verify(tattooService).persistPrepared(
                eq(7),
                eq(first.asTattoo()),
                eq(TattooSourceType.USER_POST)
        );
        verify(tattooService, org.mockito.Mockito.never()).persistPrepared(
                eq(7),
                eq(new TattooService.PreparedTattoo(62L, "object-62", null)),
                eq(TattooSourceType.USER_POST)
        );
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

    private Tattoo tattoo(Long tattooSeq, Long imageSeq) {
        OffsetDateTime now = OffsetDateTime.now();
        return Tattoo.builder()
                .tattooSeq(tattooSeq)
                .registrantSeq(7)
                .imageSeq(imageSeq)
                .sourceType(TattooSourceType.USER_POST)
                .primaryStyleSeq(1)
                .usedForTraining(false)
                .regDttm(now)
                .modDttm(now)
                .deleted(false)
                .build();
    }
}
