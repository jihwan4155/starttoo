import type {
	CommentResponse,
	Post,
	PostComment,
	PostResponse,
} from "../types/community";

/** Swagger PostResponse → UI Post */
export function mapPostResponse(dto: PostResponse): Post {
	const sortedImages = [...dto.images].sort(
		(a, b) => a.displayOrder - b.displayOrder,
	);
	const imageUrls = sortedImages.map((image) => image.imageUrl);

	return {
		id: dto.postSeq,
		author: {
			userId: dto.author.userSeq,
			nickname: dto.author.nickname,
			// role만 보면 심사 전 계정에도 뱃지가 붙는다. 서버가 role과
			// verificationStatus를 함께 보고 계산해 주는 verified를 쓴다.
			isArtist: dto.author.verified ?? false,
			avatarUrl: dto.author.profileImageUrl,
		},
		createdAt: dto.regDttm,
		imageUrl: imageUrls[0] ?? null,
		imageUrls,
		postImageIds: sortedImages.map((image) => image.postImageSeq),
		imageTattooSeqs: sortedImages.map((image) => image.tattooSeq ?? null),
		caption: dto.content ?? "",
		likeCount: dto.likeCount,
		commentCount: dto.commentCount,
		liked: dto.likedByMe,
		bookmarked: dto.bookmarkedByMe,
		comments: [],
	};
}

/** Swagger CommentResponse → UI PostComment */
export function mapCommentResponse(
	dto: CommentResponse,
	replies?: PostComment[],
): PostComment {
	return {
		id: dto.commentSeq,
		parentCommentId: dto.parentCommentSeq,
		author: {
			userId: dto.author.userSeq,
			nickname: dto.author.nickname,
			isArtist: dto.author.verified ?? false,
			avatarUrl: dto.author.profileImageUrl,
		},
		content: dto.deleted ? "" : dto.content,
		createdAt: dto.regDttm,
		likeCount: dto.likeCount,
		liked: dto.likedByMe,
		replyCount: dto.replyCount,
		replies: replies ?? [],
	};
}

/** 게시글에 표시할 이미지 URL 목록 (displayOrder 순) */
export function getPostImageUrls(post: Post): string[] {
	if (post.imageUrls && post.imageUrls.length > 0) return post.imageUrls;
	return post.imageUrl ? [post.imageUrl] : [];
}

/**
 * 해당 순서의 사진이 타투로 판별됐는지.
 *
 * 서버는 타투로 판별된 사진에만 tattooSeq를 채워 준다. 아직 판별이 끝나지 않은
 * 사진도 null이므로, 방금 올린 게시글은 판별이 끝난 뒤 목록을 다시 받아야 true가 된다.
 */
export function isTattooImage(post: Post, index: number): boolean {
	return post.imageTattooSeqs?.[index] != null;
}
