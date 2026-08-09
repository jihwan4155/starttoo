import { MASK_H, MASK_W } from "./shapeSearchConstants";

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
const EMPTY_BACKGROUND = "#f4f4f5";

/** 점이 2개 미만인 획은 화면에도 마스크에도 아무것도 남기지 않는다 */
function isDrawableStroke(stroke: Stroke): boolean {
	return stroke.length >= 2;
}

/**
 * 사진을 캔버스 안에 비율 그대로 담는다(contain).
 *
 * <p>캔버스는 마스크 좌표계(420×520)로 고정돼 있어 비율이 0.81이다. 예전에는
 * drawImage(photo, 0, 0, MASK_W, MASK_H)로 그 크기에 그대로 늘려 넣었는데, 비율이
 * 다른 사진일수록 눌려 보였다. 세로로 긴 폰 사진(3:4 = 0.75)은 위아래가 줄어든다.
 *
 * <p>잘라내기(cover)가 아니라 여백을 두는 쪽을 골랐다. 가리려는 흉터·타투가 사진
 * 가장자리에 있을 때 잘려 나가면 그 위에 그릴 수가 없기 때문이다. 여백 색은 캔버스
 * 배경과 같아 눈에 띄지 않는다.
 *
 * <p>서버로 보내는 마스크(buildMaskDataUrl)는 사진을 쓰지 않고 획만 그리므로, 여기서
 * 사진을 어떻게 배치하든 검색 결과에는 영향이 없다.
 */
function drawPhotoContained(
	ctx: CanvasRenderingContext2D,
	photo: HTMLImageElement,
): void {
	// 아직 디코딩 전이면 0이 나온다. 그 경우 예전처럼 꽉 채워 최소한 화면은 그린다.
	const width = photo.naturalWidth || MASK_W;
	const height = photo.naturalHeight || MASK_H;
	const scale = Math.min(MASK_W / width, MASK_H / height);
	const drawWidth = width * scale;
	const drawHeight = height * scale;
	ctx.drawImage(
		photo,
		(MASK_W - drawWidth) / 2,
		(MASK_H - drawHeight) / 2,
		drawWidth,
		drawHeight,
	);
}

/** 획 궤적을 잇는다. 프리뷰와 마스크가 같은 경로를 쓰도록 공용화 */
function tracePath(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
	ctx.beginPath();
	ctx.moveTo(stroke[0].x, stroke[0].y);
	for (const point of stroke.slice(1)) ctx.lineTo(point.x, point.y);
}

/**
 * 화면 캔버스를 그린다: ① 사진(없으면 회색) ② 빨간 반투명 획.
 *
 * <p>선 궤적 그대로가 검색 대상이라 안쪽을 채우지 않는다.
 */
export function drawPreview(
	ctx: CanvasRenderingContext2D,
	options: {
		strokes: Stroke[];
		brush: number;
		photo: HTMLImageElement | null;
	},
): void {
	const { strokes, brush, photo } = options;

	ctx.clearRect(0, 0, MASK_W, MASK_H);
	ctx.fillStyle = EMPTY_BACKGROUND;
	ctx.fillRect(0, 0, MASK_W, MASK_H);
	if (photo) drawPhotoContained(ctx, photo);

	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.lineWidth = brush;
	ctx.strokeStyle = PREVIEW_STROKE;
	for (const stroke of strokes) {
		if (!isDrawableStroke(stroke)) continue;
		tracePath(ctx, stroke);
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
