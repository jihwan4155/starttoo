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
		id: dto.postId,
		author: {
			userId: dto.author.userId,
			nickname: dto.author.nickname,
			isArtist: dto.author.role === "ARTIST",
			avatarUrl: dto.author.profileImageUrl,
		},
		createdAt: dto.createdAt,
		imageUrl: imageUrls[0] ?? null,
		imageUrls,
		postImageIds: sortedImages.map((image) => image.postImageId),
		caption: dto.content ?? "",
		likeCount: dto.likeCount,
		commentCount: dto.commentCount,
		liked: dto.liked,
		bookmarked: dto.bookmarked,
		hidden: dto.hidden,
		comments: [],
	};
}

/** Swagger CommentResponse → UI PostComment (루트·답글 공통) */
export function mapCommentResponse(
	dto: CommentResponse,
	replies?: PostComment[],
): PostComment {
	return {
		id: dto.commentId,
		parentCommentId: dto.parentCommentId,
		author: {
			userId: dto.author.userId,
			nickname: dto.author.nickname,
			isArtist: false,
			avatarUrl: dto.author.profileImageUrl,
		},
		content: dto.content,
		createdAt: dto.createdAt,
		likeCount: dto.likeCount,
		liked: dto.liked,
		replyCount: dto.replyCount,
		replies: replies ?? [],
	};
}

/** 게시글에 표시할 이미지 URL 목록 (displayOrder 순) */
export function getPostImageUrls(post: Post): string[] {
	if (post.imageUrls && post.imageUrls.length > 0) return post.imageUrls;
	return post.imageUrl ? [post.imageUrl] : [];
}
