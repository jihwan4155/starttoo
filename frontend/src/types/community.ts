export type PostAuthor = {
	nickname: string;
	isArtist: boolean;
};

export type PostComment = {
	id: number;
	author: PostAuthor;
	content: string;
	/** 작성 시각 (ISO 문자열) — 표시할 땐 formatTimeAgo로 변환 */
	createdAt: string;
	likeCount: number;
	replies?: PostComment[];
};

// TODO: 백엔드 PostResponse 스펙 확정되면 필드 동기화
export type Post = {
	id: number;
	author: PostAuthor;
	/** 작성 시각 (ISO 문자열) — 표시할 땐 formatTimeAgo로 변환 */
	createdAt: string;
	/** null이면 회색 플레이스홀더 표시 */
	imageUrl: string | null;
	caption: string;
	likeCount: number;
	commentCount: number;
	comments: PostComment[];
};
