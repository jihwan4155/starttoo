export type PostAuthor = {
	userId?: number;
	nickname: string;
	isArtist: boolean;
	/** 작성자 프로필 이미지 (없으면 닉네임 기반 해석 → 기본 프로필) */
	avatarUrl?: string | null;
	/** 현재 로그인 사용자가 작성한 콘텐츠 — 프로필 스토어를 실시간으로 따라감 */
	isMe?: boolean;
};

export type PostComment = {
	id: number;
	author: PostAuthor;
	content: string;
	/** 작성 시각 (ISO 문자열) — 표시할 땐 formatTimeAgo로 변환 */
	createdAt: string;
	likeCount: number;
	/** 로그인 사용자 기준 좋아요 여부 (API liked) */
	liked?: boolean;
	/** 최상위 댓글 ID (답글일 때만) */
	parentCommentId?: number | null;
	/** 최상위 댓글의 답글 수 (API replyCount) */
	replyCount?: number;
	replies?: PostComment[];
};

/** UI용 게시물 모델 (목업/화면). API 연동 시 PostResponse → Post 매핑 */
export type Post = {
	id: number;
	author: PostAuthor;
	/** 작성 시각 (ISO 문자열) — 표시할 땐 formatTimeAgo로 변환 */
	createdAt: string;
	/** 대표 이미지(첫 장). null이면 회색 플레이스홀더 표시 */
	imageUrl: string | null;
	/** displayOrder 순 전체 이미지. 없으면 imageUrl 한 장만 사용 */
	imageUrls?: string[];
	/** PATCH /posts 시 retainedPostImageIds용 */
	postImageIds?: number[];
	caption: string;
	likeCount: number;
	commentCount: number;
	/** 로그인 사용자 기준 좋아요·북마크·숨김 (API) */
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
};

export type PostAuthorDto = {
	userId: number;
	nickname: string;
	profileImageUrl: string | null;
	role: string;
};

export type PostImageDto = {
	postImageId: number;
	imageId: number;
	imageUrl: string;
	displayOrder: number;
};

export type PostResponse = {
	postId: number;
	postType: string;
	content: string | null;
	postStatus: string;
	author: PostAuthorDto;
	images: PostImageDto[];
	likeCount: number;
	commentCount: number;
	liked: boolean;
	bookmarked: boolean;
	hidden: boolean;
	bookmarkedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

export type FetchPostsParams = {
	cursor?: string;
	size?: number;
	sort?: "LATEST" | "POPULAR" | string;
	postType?: string;
	authorId?: number;
};

export type CreatePostRequest = {
	postType: string;
	content?: string;
	images: { objectKey: string }[];
};

export type UpdatePostRequest = {
	postType?: string;
	content?: string | null;
	retainedPostImageIds?: number[];
	newImages?: { objectKey: string }[];
};

export type LikeResponse = {
	postId: number;
	liked: boolean;
	likeCount: number;
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
	reportId: number;
	postId: number;
	reasonCode: string;
	reasonDetail: string | null;
	reportStatus: string;
	createdAt: string;
};

export type CommentAuthorDto = {
	userId: number;
	nickname: string;
	profileImageUrl: string | null;
};

export type CommentResponse = {
	commentId: number;
	postId: number;
	parentCommentId: number | null;
	content: string;
	commentStatus: string;
	author: CommentAuthorDto;
	likeCount: number;
	liked: boolean;
	replyCount: number;
	createdAt: string;
	updatedAt: string;
};

export type CreateCommentRequest = {
	content: string;
	parentCommentId?: number;
};

export type CommentLikeResponse = {
	commentId: number;
	liked: boolean;
	likeCount: number;
};

export type FetchCommentsParams = {
	cursor?: string;
	size?: number;
	sort?: "LATEST" | "POPULAR" | string;
};
