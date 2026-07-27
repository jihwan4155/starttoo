import type {
	CommentResponse,
	Post,
	PostComment,
	PostResponse,
} from "../types/community";

/** Swagger PostResponse → UI Post */
export function mapPostResponse(dto: PostResponse): Post {
	const imageUrls = [...dto.images]
		.sort((a, b) => a.displayOrder - b.displayOrder)
		.map((image) => image.imageUrl);

	return {
		id: dto.postId,
		author: {
			nickname: dto.author.nickname,
			isArtist: dto.author.role === "ARTIST",
			avatarUrl: dto.author.profileImageUrl,
		},
		createdAt: dto.createdAt,
		imageUrl: imageUrls[0] ?? null,
		imageUrls,
		caption: dto.content ?? "",
		likeCount: dto.likeCount,
		commentCount: dto.commentCount,
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
		author: {
			nickname: dto.author.nickname,
			isArtist: false,
			avatarUrl: dto.author.profileImageUrl,
		},
		content: dto.content,
		createdAt: dto.createdAt,
		likeCount: dto.likeCount,
		replyCount: dto.replyCount,
		replies: replies ?? [],
	};
}

/** 게시글에 표시할 이미지 URL 목록 (displayOrder 순) */
export function getPostImageUrls(post: Post): string[] {
	if (post.imageUrls && post.imageUrls.length > 0) return post.imageUrls;
	return post.imageUrl ? [post.imageUrl] : [];
}
