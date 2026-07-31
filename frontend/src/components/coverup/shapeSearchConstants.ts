import type { SearchMode } from "../../types/shapeSearch";

/**
 * ★ 마스크 캔버스 크기와 모드별 붓 굵기는 한 세트다.
 *
 * 검색 서버 튜닝 상수가 "붓 굵기 대 캔버스 크기" 비율에 맞물려 있다. 캔버스만
 * 키우거나 붓만 건드리면 요청은 정상으로 통과하고 **검색 품질만 조용히 나빠진다.**
 * 에러가 안 나서 눈에 띄지 않는 종류의 버그이므로 두 값을 여기 묶어 둔다.
 *
 * 크기를 바꿔야 하면 붓 굵기도 같은 비율로 스케일하고 백엔드에 알려
 * 검색 품질을 재검증해야 한다.
 */
export const MASK_W = 420;
export const MASK_H = 520;

export const MODES = {
	coverup: {
		label: "커버업",
		brush: 16,
		hint: "그린 영역 안쪽까지 덮는 도안을 찾아요.",
	},
	shape: {
		label: "형태 탐색",
		brush: 6,
		hint: "그린 선의 모양을 닮은 도안을 찾아요.",
	},
} as const;

/** 토글 표시 순서. 커버업 페이지라 커버업이 먼저다 */
export const MODE_KEYS = ["coverup", "shape"] as const;

export const DEFAULT_MODE: SearchMode = "coverup";

export const MIN_BRUSH = 2;
export const MAX_BRUSH = 60;
