/**
 * 이미지 위 커버업 대상 영역 (원형 선택)
 * 현재 백엔드 스펙(CoverupRequest)에는 영역 값이 없어 클라이언트 UI 전용.
 * 서버가 신체·타투 영역을 자동 탐지한다.
 */
export type CoverupSelection = {
	/** 원 중심 x (이미지 너비 대비 0~1) */
	x: number;
	/** 원 중심 y (이미지 높이 대비 0~1) */
	y: number;
	/** 반지름 (이미지 너비 대비 0~1) */
	radius: number;
};

/** POST /coverups/recommendations 응답 (CoverupResponse) */
export type CoverupResponse = {
	imageUrl: string;
	createdAt: string;
};
