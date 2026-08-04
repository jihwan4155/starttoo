package com.starttoo.backend.post.application;

import com.starttoo.backend.common.error.BusinessException;
import com.starttoo.backend.common.error.ErrorCode;
import com.starttoo.backend.post.api.PostDtos;
import com.starttoo.backend.post.domain.Post;
import com.starttoo.backend.post.domain.PostImage;
import com.starttoo.backend.post.domain.PostImageRepository;
import com.starttoo.backend.post.domain.PostRepository;
import com.starttoo.backend.post.domain.PostStatus;
import com.starttoo.backend.tattoo.application.TattooService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PostWriteService {

    private final PostRepository postRepository;
    private final PostImageRepository postImageRepository;

    @Transactional
    public Post create(
            Integer userSeq,
            PostDtos.CreatePostRequest request,
            List<TattooService.PreparedPostImage> preparedImages
    ) {
        try {
            OffsetDateTime now = OffsetDateTime.now();
            Post post = postRepository.save(Post.builder()
                    .authorSeq(userSeq)
                    .content(request.content())
                    .postStatus(PostStatus.PUBLISHED)
                    .likeCount(0)
                    .commentCount(0)
                    .reportCount(0)
                    .regDttm(now)
                    .modDttm(now)
                    .modUsrSeq(userSeq)
                    .deleted(false)
                    .build());
            for (int index = 0; index < preparedImages.size(); index++) {
                postImageRepository.save(PostImage.builder()
                        .postSeq(post.getPostSeq())
                        .imageSeq(preparedImages.get(index).imageSeq())
                        .displayOrder((short) (index + 1))
                        .regDttm(now)
                        .modDttm(now)
                        .build());
            }
            return post;
        } catch (DataIntegrityViolationException exception) {
            throw BusinessException.of(ErrorCode.DUPLICATE_RESOURCE);
        }
    }
}
