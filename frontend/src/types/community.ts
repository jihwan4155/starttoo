export type PostAuthor = {
	userId?: number;
	nickname: string;
	isArtist: boolean;
	avatarUrl?: string | null;
	isMe?: boolean;
};

export type PostComment = {
	id: number;
	author: PostAuthor;
	content: string;
	createdAt: string;
	likeCount: number;
	liked?: boolean;
	parentCommentId?: number | null;
	replyCount?: number;
	replies?: PostComment[];
};

/** UI용 게시물 모델 */
export type Post = {
	id: number;
	author: PostAuthor;
	createdAt: string;
	imageUrl: string | null;
	imageUrls?: string[];
	postImageIds?: number[];
	caption: string;
	likeCount: number;
	commentCount: number;
	liked?: boolean;
	bookmarked?: boolean;
	hidden?: boolean;
	comments: PostComment[];
};

/* ─── Backend DTO (Swagger /v1) ─── */

export type CursorPage<T> = {
	items: T[];
	nextCursor: string | null;
	hasNext: boolean;
	size?: number;
};

export type PostAuthorDto = {
	userSeq: number;
	nickname: string;
	role: string;
	profileImageSeq: number | null;
	profileImageUrl: string | null;
	/** role=ARTIST이고 인증까지 끝난 계정인지 — 뱃지 판정은 이 값만 본다 */
	verified: boolean;
};

export type PostImageDto = {
	postImageSeq: number;
	imageSeq: number;
	imageUrl: string;
	tattooSeq: number | null;
	displayOrder: number;
};

export type PostResponse = {
	postSeq: number;
	author: PostAuthorDto;
	content: string | null;
	likeCount: number;
	commentCount: number;
	images: PostImageDto[];
	likedByMe: boolean;
	bookmarkedByMe: boolean;
	regDttm: string;
	modDttm: string;
};

export type FetchPostsParams = {
	cursor?: string | number;
	size?: number;
	authorSeq?: number;
};

export type CreatePostRequest = {
	content?: string;
	imageSeqs: number[];
};

export type UpdatePostRequest = {
	content?: string | null;
};

export type StateResponse = {
	enabled: boolean;
};

export type LikeResponse = {
	postId: number;
	liked: boolean;
	likeCount?: number;
};

export type BookmarkResponse = {
	postId: number;
	bookmarked: boolean;
};

export type HiddenResponse = {
	postId: number;
	hidden: boolean;
};

export type ReportReasonCode =
	| "SPAM"
	| "INAPPROPRIATE"
	| "HARASSMENT"
	| "COPYRIGHT"
	| "OTHER";

export type ReportRequest = {
	reasonCode: ReportReasonCode;
	reasonDetail?: string;
};

export type ReportResponse = {
	reportSeq: number;
	reportStatus: string;
};

export type CommentAuthorDto = {
	userSeq: number;
	nickname: string;
	profileImageSeq: number | null;
	profileImageUrl: string | null;
	/** role=ARTIST이고 인증까지 끝난 계정인지 — 뱃지 판정은 이 값만 본다 */
	verified: boolean;
};

export type CommentResponse = {
	commentSeq: number;
	postSeq: number;
	parentCommentSeq: number | null;
	content: string;
	likeCount: number;
	replyCount: number;
	likedByMe: boolean;
	deleted: boolean;
	author: CommentAuthorDto;
	regDttm: string;
	modDttm: string;
};

export type CreateCommentRequest = {
	content: string;
	parentCommentSeq?: number | null;
};

export type CommentLikeResponse = {
	commentId: number;
	liked: boolean;
	likeCount?: number;
};

export type FetchCommentsParams = {
	cursor?: string | number;
	size?: number;
};
