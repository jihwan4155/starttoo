/** 백엔드 Archive 도메인 타입 (Swagger: Starttoo API - Archive) */

/** 보관함 항목 (GET /archive) */
export type ArchiveItem = {
	tattooId: number;
	originalImageUrl: string;
	designImageUrl: string;
	primaryStyle: string;
	secondaryStyle: string;
	rendering: string;
	savedAt: string;
};

/** GET /archive — 커서 기반 페이지 */
export type ArchivePage = {
	items: ArchiveItem[];
	nextCursor: string | null;
	hasNext: boolean;
};

/** POST·DELETE /archive/{tattooId} — 저장/삭제 토글 응답 */
export type ArchiveToggleResponse = {
	tattooId: number;
	/** 현재 저장 상태 (저장 true / 삭제 false) */
	saved: boolean;
	savedAt: string | null;
};

/** GET /archive 쿼리 파라미터 */
export type ArchivePageQuery = {
	cursor?: string;
	size?: number;
};
