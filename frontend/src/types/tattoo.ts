/**
 * 백엔드 Tattoo 도메인 타입
 * 기준: https://starttoo.duckdns.org/v3/api-docs (2026-07-31 확인)
 */

export type TattooSubject = {
	subjectSeq: number;
	subjectName: string;
};

/** GET /tattoo-designs 항목 */
export type TattooDesignItem = {
	tattooSeq: number;
	designImageSeq: number;
	/** 단기 Presigned GET URL — 오래 들고 있으면 만료된다 */
	designImageUrl: string;
	/** 취향 설문에 그대로 넘기는 주 스타일 seq */
	primaryStyleSeq: number | null;
	/** 분류되지 않았으면 null */
	colorSeq: number | null;
	subjects: TattooSubject[];
	archivedByMe: boolean;
	regDttm: string;
};

/** GET /tattoo-designs 쿼리 파라미터 */
export type FetchTattooDesignsParams = {
	cursor?: string;
	/** 1~50, 기본 20 */
	size?: number;
};
