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
			isArtist: dto.author.role === "ARTIST",
			avatarUrl: dto.author.profileImageUrl,
		},
		createdAt: dto.regDttm,
		imageUrl: imageUrls[0] ?? null,
		imageUrls,
		postImageIds: sortedImages.map((image) => image.postImageSeq),
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
			isArtist: false,
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
