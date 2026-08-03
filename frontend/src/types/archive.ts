/** 백엔드 Archive / TattooDesignItem (GET /archive) */

export type ArchiveSubjectItem = {
	subjectSeq: number;
	subjectName: string;
};

/** Swagger TattooDesignItem — UI에서는 ArchiveItem으로 매핑 */
export type TattooDesignItemDto = {
	tattooSeq: number;
	designImageSeq: number;
	designImageUrl: string;
	primaryStyleSeq: number | null;
	colorSeq: number | null;
	subjects: ArchiveSubjectItem[];
	archivedDttm: string;
};

/** 보관함 항목 (화면·드래그용) */
export type ArchiveItem = {
	tattooId: number;
	/** POST /collections의 imageSeq로 쓰는 도안 이미지 seq */
	designImageSeq: number;
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

/** PUT/DELETE /archive/{tattooSeq} 응답 */
export type ArchiveStateResponse = {
	enabled: boolean;
};

/** POST·DELETE /archive/{tattooId} — UI 토글 훅용 */
export type ArchiveToggleResponse = {
	tattooId: number;
	saved: boolean;
	savedAt: string | null;
};

/** GET /archive 쿼리 파라미터 */
export type ArchivePageQuery = {
	cursor?: string;
	size?: number;
};
