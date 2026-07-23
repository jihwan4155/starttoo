export type PostAuthor = {
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
