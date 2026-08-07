import { MASK_H, MASK_W } from "./shapeSearchConstants";
import type { SearchMode } from "../../types/shapeSearch";

export type Point = { x: number; y: number };
export type Stroke = Point[];

/**
 * 화면 캔버스와 서버로 보내는 마스크는 서로 다른 그림이다. 둘이 어떻게 달라야
 * 하는지 한눈에 보이도록 두 함수를 나란히 둔다.
 *
 * - 화면: 사진 배경 + 빨간 반투명 획 (유저에게 보여주는 것)
 * - 마스크: 검은 배경 + 흰 획만 (서버가 보는 것)
 *
 * 서버는 "어디에 잉크가 있는가"만 본다(임계값 10으로 이진화). 사진·색·투명도는
 * 노이즈이므로 마스크에 섞으면 안 된다.
 */

// 화면 프리뷰 전용 색. 마스크에는 절대 쓰지 않는다.
const PREVIEW_STROKE = "rgba(220,38,38,0.85)";
const PREVIEW_FILL = "rgba(220,38,38,0.28)";
const EMPTY_BACKGROUND = "#f4f4f5";

/** 점이 2개 미만인 획은 화면에도 마스크에도 아무것도 남기지 않는다 */
export function isDrawableStroke(stroke: Stroke): boolean {
	return stroke.length >= 2;
}

/**
 * 서버가 획 끝과 끝 사이를 메워 주는 거리(px, 마스크 좌표계).
 *
 * <p>면(gate) 모드의 query_mask_from_strokes는 마스크를 5×5 커널로 2번 부풀린
 * 뒤(dilate) 윤곽을 찾아 내부를 채운다. 커널 반경이 2px이므로 한쪽 끝이 4px씩,
 * 양 끝 합쳐 8px까지 벌어진 틈이 메워진다. 마스크는 리사이즈 없이 420×520
 * 그대로 전달되므로 이 값을 화면 좌표에서 그대로 쓸 수 있다.
 */
const SERVER_BRIDGE_PX = 8;

/**
 * 이 획이 서버 기준으로 '닫힌 면'인지.
 *
 * <p>면 모드의 서버 채움은 획이 고리를 이룰 때만 안쪽까지 닿는다. 열린 획은
 * 윤곽이 획 자체를 두르고 말아 획 굵기만큼만 칠해진다. 시작점과 끝점이 붓 굵기 +
 * 서버가 메워 주는 거리 안에 들어와야 안쪽이 찬다.
 */
export function isClosedStroke(stroke: Stroke, brush: number): boolean {
	if (!isDrawableStroke(stroke)) return false;
	const first = stroke[0];
	const last = stroke[stroke.length - 1];
	const gap = Math.hypot(last.x - first.x, last.y - first.y);
	// 양 끝은 둥근 캡이라 붓 굵기만큼은 이미 서로 닿아 있다
	return gap <= brush + SERVER_BRIDGE_PX;
}

/** 획 궤적을 잇는다. 프리뷰와 마스크가 같은 경로를 쓰도록 공용화 */
function tracePath(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
	ctx.beginPath();
	ctx.moveTo(stroke[0].x, stroke[0].y);
	for (const point of stroke.slice(1)) ctx.lineTo(point.x, point.y);
}

/**
 * 화면 캔버스를 그린다: ① 사진(없으면 회색) ② 빨간 반투명 획
 * ③ coverup 모드에서 다 그린 획의 내부 채움 프리뷰.
 *
 * <p>서버가 coverup에서 안쪽을 채우므로 결과를 미리 보여주는 것이다.
 * shape는 선 궤적 그대로가 검색 대상이라 채우지 않는다.
 */
export function drawPreview(
	ctx: CanvasRenderingContext2D,
	options: {
		strokes: Stroke[];
		brush: number;
		mode: SearchMode;
		photo: HTMLImageElement | null;
	},
): void {
	const { strokes, brush, mode, photo } = options;

	ctx.clearRect(0, 0, MASK_W, MASK_H);
	ctx.fillStyle = EMPTY_BACKGROUND;
	ctx.fillRect(0, 0, MASK_W, MASK_H);
	if (photo) ctx.drawImage(photo, 0, 0, MASK_W, MASK_H);

	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.lineWidth = brush;
	for (const stroke of strokes) {
		if (!isDrawableStroke(stroke)) continue;
		tracePath(ctx, stroke);
		// 고리를 이룬 획만 채운다. 열린 획은 서버도 안쪽을 못 채우므로
		// 여기서 채우면 결과와 다른 그림을 보여주게 된다.
		if (mode === "coverup" && isClosedStroke(stroke, brush)) {
			// closePath()를 부르면 시작점과 끝점을 잇는 선분이 path에 들어가고,
			// 아래 stroke()가 그 선분까지 그려 버린다. fill()은 그 선분 없이도
			// 닫힌 것으로 보고 채우므로 부르지 않는다.
			ctx.fillStyle = PREVIEW_FILL;
			ctx.fill();
		}
		ctx.strokeStyle = PREVIEW_STROKE;
		ctx.stroke();
	}
}

/**
 * 서버로 보낼 마스크를 굽는다. 눈에 보이지 않는 임시 캔버스를 쓴다.
 *
 * <p>지켜야 할 규칙:
 * <ul>
 *   <li>캔버스는 정확히 MASK_W×MASK_H — 서버 튜닝 상수가 이 크기 기준이다
 *   <li>배경은 순수 #000, 획은 순수 #fff — 서버가 임계값 10으로 이진화한다
 *   <li>lineCap·lineJoin은 round — 서버가 이 형태의 획을 전제로 튜닝됐다
 *   <li>fill()하지 않는다 — 안쪽 채움은 서버가 모드에 따라 결정한다
 * </ul>
 *
 * @returns data: 접두어를 포함한 PNG base64. 그릴 획이 없으면 null
 */
export function buildMaskDataUrl(
	strokes: Stroke[],
	brush: number,
): string | null {
	const drawable = strokes.filter(isDrawableStroke);
	if (drawable.length === 0) return null;

	const canvas = document.createElement("canvas");
	canvas.width = MASK_W;
	canvas.height = MASK_H;
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;

	ctx.fillStyle = "#000";
	ctx.fillRect(0, 0, MASK_W, MASK_H);
	ctx.strokeStyle = "#fff";
	ctx.lineWidth = brush;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	for (const stroke of drawable) {
		tracePath(ctx, stroke);
		ctx.stroke();
	}
	return canvas.toDataURL("image/png");
}
