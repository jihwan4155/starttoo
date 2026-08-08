import type { SearchMode } from "../../types/shapeSearch";

/**
 * ★ 마스크 캔버스 크기와 붓 굵기는 한 세트다.
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

/**
 * 붓 굵기 기본값. 모드를 고르면 이 값에서 시작한다.
 *
 * <p>검색 엔진 튜닝 기준값이 모드마다 다르다 — shape 6px · coverup 16px. 한동안
 * 두 모드를 6px로 통일해 뒀는데, 그러면 coverup은 튜닝값보다 얇은 획을 보내게 되어
 * 서버의 채움(query_mask_from_strokes)이 기대보다 좁은 면을 만든다. 엔진 기준값으로
 * 되돌린 상태다.
 *
 * <p>바꾸려면 MASK_W/MASK_H와 한 세트로 봐야 한다(위 주석 참고).
 */
export const BRUSH_PX: Record<SearchMode, number> = {
	coverup: 16,
	shape: 6,
};

/**
 * 사용자가 조절할 수 있는 붓 굵기 범위.
 *
 * <p>기본값은 위 BRUSH_PX(엔진 튜닝 기준값)이고, 슬라이더는 그 주변만 연다.
 * 굵기는 마스크 크기와 한 세트라(맨 위 주석) 기준값에서 멀어질수록 검색 품질이
 * **에러 없이 조용히** 떨어진다. 범위를 더 넓히려면 백엔드와 함께 재검증해야 한다.
 */
export const BRUSH_MIN = 4;
export const BRUSH_MAX = 20;
export const BRUSH_STEP = 1;

/** 범위 밖 값이 서버로 나가지 않게 막는다 */
export function clampBrush(px: number): number {
	if (!Number.isFinite(px)) return BRUSH_MIN;
	return Math.min(BRUSH_MAX, Math.max(BRUSH_MIN, Math.round(px)));
}

/**
 * 화면 라벨은 사용자가 그리는 방식을 그대로 부른다.
 * 면 = 영역을 칠하면 그 안쪽까지 덮는 도안, 선 = 그린 선의 모양을 닮은 도안.
 * (엔진 내부 이름 line/gate는 노출하지 않는다)
 */
export const MODES = {
	coverup: {
		label: "면",
		hint: "그린 영역 안쪽까지 덮는 도안을 찾아요.",
	},
	shape: {
		label: "선",
		hint: "그린 선의 모양을 닮은 도안을 찾아요.",
	},
} as const;

/** 토글 표시 순서. 커버업 페이지라 면이 먼저다 */
export const MODE_KEYS = ["coverup", "shape"] as const;

/**
 * 지금은 선 모드만 쓴다.
 *
 * <p>면 모드는 화면에서만 걷어낸 상태다(모드 토글 UI 제거). 엔진·마스크 쪽 코드는
 * 그대로 두었으니 되살리려면 CoverUpPage/MobileCoverUpFlow에 MODE_KEYS 토글을
 * 다시 넣고 이 값을 "coverup"으로 돌리면 된다.
 */
export const DEFAULT_MODE: SearchMode = "shape";

/**
 * 화면에 보여줄 도안 수. 서버는 최대 16장을 주지만 한 화면에 담기도록 잘라 쓴다.
 * 점수 내림차순이라 앞에서 자르면 상위 N장이 남는다.
 */
export const MAX_RESULTS = 8;
