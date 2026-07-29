/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TrackedPoints } from "./opticalFlowTrack";
import type { SmileMarkerFeatures } from "./smileMarkerTracker";
import { scaledTrackedPoints } from "./smileMarkerTracker";

let tmpCanvas: HTMLCanvasElement | null = null;
let inpaintCanvas: HTMLCanvasElement | null = null;
const designCanvasCache = new WeakMap<object, HTMLCanvasElement>();

function getTmpCanvas(width: number, height: number): HTMLCanvasElement {
	if (!tmpCanvas) tmpCanvas = document.createElement("canvas");
	if (tmpCanvas.width !== width || tmpCanvas.height !== height) {
		tmpCanvas.width = width;
		tmpCanvas.height = height;
	}
	return tmpCanvas;
}

function getDesignCanvas(cv: any, designMat: any): HTMLCanvasElement {
	const cached = designCanvasCache.get(designMat);
	if (cached) return cached;
	const canvas = document.createElement("canvas");
	canvas.width = designMat.cols;
	canvas.height = designMat.rows;
	cv.imshow(canvas, designMat);
	designCanvasCache.set(designMat, canvas);
	return canvas;
}

/** Converts a decoded image into an RGBA cv.Mat and removes white paper. */
export function designImageToMat(cv: any, img: HTMLImageElement): any {
	const canvas = document.createElement("canvas");
	canvas.width = img.naturalWidth;
	canvas.height = img.naturalHeight;
	const ctx = canvas.getContext("2d")!;
	ctx.drawImage(img, 0, 0);
	const mat = cv.imread(canvas);

	// Preserve real PNG transparency. For an opaque JPEG/screenshot, turn
	// near-white paper into a soft alpha mask so it does not render as a box.
	const data = mat.data as Uint8Array;
	let hasUsefulTransparency = false;
	for (let index = 3; index < data.length; index += 4) {
		if (data[index] < 245) {
			hasUsefulTransparency = true;
			break;
		}
	}
	if (!hasUsefulTransparency) {
		for (let index = 0; index < data.length; index += 4) {
			const luminance =
				data[index] * 0.2126 +
				data[index + 1] * 0.7152 +
				data[index + 2] * 0.0722;
			data[index + 3] = Math.min(
				data[index + 3],
				Math.max(0, Math.min(255, (250 - luminance) * 7))
			);
		}
	}
	return mat;
}

interface PointLike {
	x: number;
	y: number;
}

function getInpaintCanvas(width: number, height: number): HTMLCanvasElement {
	if (!inpaintCanvas) inpaintCanvas = document.createElement("canvas");
	if (inpaintCanvas.width !== width || inpaintCanvas.height !== height) {
		inpaintCanvas.width = width;
		inpaintCanvas.height = height;
	}
	return inpaintCanvas;
}

function distanceToStroke(
	x: number,
	y: number,
	start: PointLike,
	end: PointLike
): { distance: number; normalX: number; normalY: number } {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const lengthSquared = dx * dx + dy * dy;
	const length = Math.sqrt(lengthSquared);
	if (length < 1e-5) {
		return {
			distance: Math.hypot(x - start.x, y - start.y),
			normalX: 0,
			normalY: 1,
		};
	}
	const amount = Math.min(
		1,
		Math.max(0, ((x - start.x) * dx + (y - start.y) * dy) / lengthSquared)
	);
	const closestX = start.x + dx * amount;
	const closestY = start.y + dy * amount;
	return {
		distance: Math.hypot(x - closestX, y - closestY),
		normalX: -dy / length,
		normalY: dx / length,
	};
}

/**
 * Rebuilds each pen stroke from real pixels sampled on both sides of it.
 * Unlike a flat average-color line, this keeps the local lighting gradient
 * and a little skin texture, then feathers the repaired edge.
 */
export function concealSmileMarker(
	ctx: CanvasRenderingContext2D,
	features: SmileMarkerFeatures,
	sampleContext: CanvasRenderingContext2D = ctx
): void {
	const eyeLength =
		(Math.hypot(
			features.leftEyeBottom.x - features.leftEyeTop.x,
			features.leftEyeBottom.y - features.leftEyeTop.y
		) +
			Math.hypot(
				features.rightEyeBottom.x - features.rightEyeTop.x,
				features.rightEyeBottom.y - features.rightEyeTop.y
			)) *
		0.5;

	const strokes: [PointLike, PointLike][] = [
		[features.leftEyeTop, features.leftEyeBottom],
		[features.rightEyeTop, features.rightEyeBottom],
		[features.mouthLeft, features.mouthRight],
	];
	// 움직일 때 트래킹이 살짝 어긋나도 펜 선이 계속 덮이도록 가림 폭을 넓힘
	const coverRadius = Math.max(3, eyeLength * 0.22);
	const sampleOffset = coverRadius * 2.6 + 2;
	const points = Object.values(features);
	const margin = sampleOffset + coverRadius + 3;
	const left = Math.max(
		0,
		Math.floor(Math.min(...points.map((point) => point.x)) - margin)
	);
	const top = Math.max(
		0,
		Math.floor(Math.min(...points.map((point) => point.y)) - margin)
	);
	const right = Math.min(
		sampleContext.canvas.width,
		Math.ceil(Math.max(...points.map((point) => point.x)) + margin)
	);
	const bottom = Math.min(
		sampleContext.canvas.height,
		Math.ceil(Math.max(...points.map((point) => point.y)) + margin)
	);
	const width = right - left;
	const height = bottom - top;
	if (width < 2 || height < 2) return;

	const source = sampleContext.getImageData(left, top, width, height);
	const patchCanvas = getInpaintCanvas(width, height);
	const patchContext = patchCanvas.getContext("2d");
	if (!patchContext) return;
	const patch = patchContext.createImageData(width, height);

	function samplePixel(
		globalX: number,
		globalY: number
	): [number, number, number] | null {
		const x = Math.round(globalX) - left;
		const y = Math.round(globalY) - top;
		if (x < 0 || x >= width || y < 0 || y >= height) return null;
		const index = (y * width + x) * 4;
		const red = source.data[index];
		const green = source.data[index + 1];
		const blue = source.data[index + 2];
		if (Math.max(red, green, blue) < 45) return null;
		return [red, green, blue];
	}

	for (let localY = 0; localY < height; localY++) {
		for (let localX = 0; localX < width; localX++) {
			const x = left + localX;
			const y = top + localY;
			let nearest: {
				distance: number;
				normalX: number;
				normalY: number;
			} | null = null;
			for (const [start, end] of strokes) {
				const candidate = distanceToStroke(x, y, start, end);
				if (!nearest || candidate.distance < nearest.distance)
					nearest = candidate;
			}
			if (!nearest || nearest.distance > coverRadius * 1.35) continue;

			const samples: [number, number, number][] = [];
			for (const direction of [-1, 1]) {
				for (const extra of [0, 2]) {
					const sampled = samplePixel(
						x + nearest.normalX * (sampleOffset + extra) * direction,
						y + nearest.normalY * (sampleOffset + extra) * direction
					);
					if (sampled) samples.push(sampled);
				}
			}
			if (samples.length < 2) continue;

			const outputIndex = (localY * width + localX) * 4;
			patch.data[outputIndex] =
				samples.reduce((sum, color) => sum + color[0], 0) / samples.length;
			patch.data[outputIndex + 1] =
				samples.reduce((sum, color) => sum + color[1], 0) / samples.length;
			patch.data[outputIndex + 2] =
				samples.reduce((sum, color) => sum + color[2], 0) / samples.length;
			const featherStart = coverRadius * 0.72;
			const alpha =
				nearest.distance <= featherStart
					? 1
					: 1 -
						(nearest.distance - featherStart) /
							Math.max(coverRadius * 1.35 - featherStart, 0.1);
			patch.data[outputIndex + 3] = Math.round(
				Math.max(0, Math.min(1, alpha)) * 255
			);
		}
	}

	patchContext.clearRect(0, 0, width, height);
	patchContext.putImageData(patch, 0, 0);
	ctx.save();
	ctx.filter = `blur(${Math.max(0.35, eyeLength * 0.012)}px)`;
	ctx.drawImage(patchCanvas, left, top);
	ctx.restore();
}

/**
 * 세 획을 각각 덧칠하는 대신, 마커를 감싸는 사각 영역 전체를 주변 피부색으로
 * 덮는다. 회전된 마커에 맞춰 (눈-눈 = 가로축, 눈→입 = 세로축) 지역 좌표계를 세우고,
 * 네 모서리 바깥의 실제 피부색을 bilinear 보간으로 채워 가장자리만 페더링한다.
 * 획 사이 틈까지 확실히 가려 움직일 때 펜 선이 새어나오지 않는다.
 */
export function concealSmileMarkerArea(
	ctx: CanvasRenderingContext2D,
	features: SmileMarkerFeatures,
	sampleContext: CanvasRenderingContext2D = ctx,
	/** 넓은 피부에서 뽑은 안정적인 대표 피부색. 실제 피부 복사가 실패하는
	 * 픽셀의 폴백으로 쓴다 (마커 옆 잉크 헐로 오염 회피). */
	baseColor: [number, number, number] | null = null,
	/** 팔 축 각도(도). 이 방향으로 옆 피부를 복사해온다. null이면 마커 세로축 사용. */
	armAxisAngle: number | null = null
): void {
	const {
		leftEyeTop,
		leftEyeBottom,
		rightEyeTop,
		rightEyeBottom,
		mouthLeft,
		mouthRight,
	} = features;
	const all = [
		leftEyeTop,
		leftEyeBottom,
		rightEyeTop,
		rightEyeBottom,
		mouthLeft,
		mouthRight,
	];
	const mid = (a: PointLike, b: PointLike): PointLike => ({
		x: (a.x + b.x) * 0.5,
		y: (a.y + b.y) * 0.5,
	});

	const eyeLength =
		(Math.hypot(
			leftEyeBottom.x - leftEyeTop.x,
			leftEyeBottom.y - leftEyeTop.y
		) +
			Math.hypot(
				rightEyeBottom.x - rightEyeTop.x,
				rightEyeBottom.y - rightEyeTop.y
			)) *
		0.5;

	// 지역 좌표축: u = 왼눈→오른눈(가로), d = 눈→입(세로)
	const leftEyeMid = mid(leftEyeTop, leftEyeBottom);
	const rightEyeMid = mid(rightEyeTop, rightEyeBottom);
	let ux = rightEyeMid.x - leftEyeMid.x;
	let uy = rightEyeMid.y - leftEyeMid.y;
	const uLen = Math.hypot(ux, uy) || 1;
	ux /= uLen;
	uy /= uLen;
	let dx = -uy;
	let dy = ux;
	const eyeMid = mid(leftEyeMid, rightEyeMid);
	const mouthMid = mid(mouthLeft, mouthRight);
	if ((mouthMid.x - eyeMid.x) * dx + (mouthMid.y - eyeMid.y) * dy < 0) {
		dx = -dx;
		dy = -dy;
	}

	let minU = Infinity;
	let maxU = -Infinity;
	let minD = Infinity;
	let maxD = -Infinity;
	for (const p of all) {
		const u = (p.x - eyeMid.x) * ux + (p.y - eyeMid.y) * uy;
		const d = (p.x - eyeMid.x) * dx + (p.y - eyeMid.y) * dy;
		if (u < minU) minU = u;
		if (u > maxU) maxU = u;
		if (d < minD) minD = d;
		if (d > maxD) maxD = d;
	}
	// 방사형 페이드가 녹아들 여유를 두려 마커 획 바깥으로 넉넉히 확장
	const margin = Math.max(4, eyeLength * 0.55);
	minU -= margin;
	maxU += margin;
	minD -= margin;
	maxD += margin;
	const spanU = maxU - minU;
	const spanD = maxD - minD;
	if (spanU < 2 || spanD < 2) return;

	const toXY = (u: number, d: number): PointLike => ({
		x: eyeMid.x + u * ux + d * dx,
		y: eyeMid.y + u * uy + d * dy,
	});

	const fillCornersXY = [
		toXY(minU, minD),
		toXY(maxU, minD),
		toXY(maxU, maxD),
		toXY(minU, maxD),
	];

	// 복사해올 방향: 팔 축(있으면) 아니면 마커 세로축
	let dirX: number;
	let dirY: number;
	if (armAxisAngle != null) {
		const rad = (armAxisAngle * Math.PI) / 180;
		dirX = Math.cos(rad);
		dirY = Math.sin(rad);
	} else {
		dirX = dx;
		dirY = dy;
	}
	// 소스가 마커와 겹치지 않도록 영역 최대 크기보다 살짝 더 이동
	const offsetDist = Math.max(spanU, spanD) * 1.05 + eyeLength * 0.4;

	// getImageData 범위: 채울 영역 + 양쪽(±) 소스 후보 영역을 모두 포함
	const spread = [
		...fillCornersXY,
		...fillCornersXY.map((p) => ({
			x: p.x + dirX * offsetDist,
			y: p.y + dirY * offsetDist,
		})),
		...fillCornersXY.map((p) => ({
			x: p.x - dirX * offsetDist,
			y: p.y - dirY * offsetDist,
		})),
	];
	const canvasW = sampleContext.canvas.width;
	const canvasH = sampleContext.canvas.height;
	const boxLeft = Math.max(0, Math.floor(Math.min(...spread.map((p) => p.x))));
	const boxTop = Math.max(0, Math.floor(Math.min(...spread.map((p) => p.y))));
	const boxRight = Math.min(
		canvasW,
		Math.ceil(Math.max(...spread.map((p) => p.x)))
	);
	const boxBottom = Math.min(
		canvasH,
		Math.ceil(Math.max(...spread.map((p) => p.y)))
	);
	const boxW = boxRight - boxLeft;
	const boxH = boxBottom - boxTop;
	if (boxW < 2 || boxH < 2) return;

	const frame = sampleContext.getImageData(boxLeft, boxTop, boxW, boxH);
	const pixelAt = (gx: number, gy: number): [number, number, number] | null => {
		const x = Math.round(gx) - boxLeft;
		const y = Math.round(gy) - boxTop;
		if (x < 0 || x >= boxW || y < 0 || y >= boxH) return null;
		const i = (y * boxW + x) * 4;
		const r = frame.data[i];
		const g = frame.data[i + 1];
		const b = frame.data[i + 2];
		// 어두운 잉크/그림자/배경은 피부 소스로 부적합
		if (Math.max(r, g, b) < 40) return null;
		return [r, g, b];
	};

	// 소스 방향(±) 선택: 밝은(피부) 픽셀이 더 많은 쪽에서 복사
	const centerXY = toXY((minU + maxU) / 2, (minD + maxD) / 2);
	const skinScore = (cx: number, cy: number): number => {
		let count = 0;
		for (let sy = -2; sy <= 2; sy++) {
			for (let sx = -2; sx <= 2; sx++) {
				if (pixelAt(cx + sx * spanU * 0.15, cy + sy * spanD * 0.15)) count++;
			}
		}
		return count;
	};
	const posScore = skinScore(
		centerXY.x + dirX * offsetDist,
		centerXY.y + dirY * offsetDist
	);
	const negScore = skinScore(
		centerXY.x - dirX * offsetDist,
		centerXY.y - dirY * offsetDist
	);
	const sign = posScore >= negScore ? 1 : -1;
	const offX = dirX * offsetDist * sign;
	const offY = dirY * offsetDist * sign;

	const patchCanvas = getInpaintCanvas(boxW, boxH);
	const patchContext = patchCanvas.getContext("2d");
	if (!patchContext) return;
	const patch = patchContext.createImageData(boxW, boxH);
	// 방사형 페이드: 중앙(코어)까지는 불투명하게 마커를 덮고, 밖으로 갈수록 투명해져
	// 네모 경계 없이 부드러운 얼룩처럼 주변 피부에 녹아든다.
	const CORE_R = 0.72; // 이 정규화 반경까지는 완전 불투명 (마커를 덮을 만큼)
	const EDGE_R = 1.1; // 이 반경에서 완전 투명
	for (let py = 0; py < boxH; py++) {
		for (let px = 0; px < boxW; px++) {
			const gx = boxLeft + px;
			const gy = boxTop + py;
			const u = (gx - eyeMid.x) * ux + (gy - eyeMid.y) * uy;
			const d = (gx - eyeMid.x) * dx + (gy - eyeMid.y) * dy;
			const a = (u - minU) / spanU;
			const b = (d - minD) / spanD;
			if (a < 0 || a > 1 || b < 0 || b > 1) continue;
			// 중앙 기준 방사형 거리(정규화) → smoothstep으로 1→0 페이드
			const na = (a - 0.5) * 2;
			const nb = (b - 0.5) * 2;
			const rr = Math.hypot(na, nb);
			const tt = Math.max(0, Math.min(1, (rr - CORE_R) / (EDGE_R - CORE_R)));
			const alpha = 1 - tt * tt * (3 - 2 * tt);
			if (alpha <= 0) continue;
			// 팔 축을 따라 오프셋한 실제 피부 픽셀을 복사 (실패 시 안정 피부색)
			const copied = pixelAt(gx + offX, gy + offY) ?? baseColor;
			if (!copied) continue;
			const o = (py * boxW + px) * 4;
			patch.data[o] = copied[0];
			patch.data[o + 1] = copied[1];
			patch.data[o + 2] = copied[2];
			patch.data[o + 3] = Math.round(alpha * 255);
		}
	}

	patchContext.clearRect(0, 0, boxW, boxH);
	patchContext.putImageData(patch, 0, 0);
	ctx.save();
	ctx.filter = `blur(${Math.max(0.5, eyeLength * 0.03)}px)`;
	ctx.drawImage(patchCanvas, boxLeft, boxTop);
	ctx.restore();
}

export interface CompositeOptions {
	scale?: number;
	opacity?: number;
	curvature?: number;
}

function interpolatePoint(
	first: PointLike,
	second: PointLike,
	amount: number
): PointLike {
	return {
		x: first.x + (second.x - first.x) * amount,
		y: first.y + (second.y - first.y) * amount,
	};
}

/**
 * Draws the tattoo as narrow surface strips. Their spacing follows a
 * cylindrical sine projection, so the outer portions compress and darken as
 * they wrap around the visible side of the forearm.
 */
export function compositeDesignCurvedOntoCanvas(
	cv: any,
	ctx: CanvasRenderingContext2D,
	designMat: any,
	quad: TrackedPoints,
	options: CompositeOptions = {}
): void {
	const designCanvas = getDesignCanvas(cv, designMat);
	const scaledQuad = scaledTrackedPoints(quad, options.scale ?? 1);
	const stripCount = 18;
	const curvature = Math.min(1.15, Math.max(0, options.curvature ?? 0.82));
	const sineAtEdge = Math.sin(curvature);

	function curvedFraction(value: number): number {
		if (curvature < 1e-4) return value;
		const signed = value * 2 - 1;
		return 0.5 + (Math.sin(signed * curvature) / sineAtEdge) * 0.5;
	}

	ctx.save();
	ctx.globalCompositeOperation = "multiply";
	ctx.imageSmoothingEnabled = true;
	ctx.filter = "blur(0.4px)";

	for (let index = 0; index < stripCount; index++) {
		const sourceStart = index / stripCount;
		const sourceEnd = (index + 1) / stripCount;
		const surfaceStart = curvedFraction(sourceStart);
		const surfaceEnd = curvedFraction(sourceEnd);
		const leftStart = interpolatePoint(
			scaledQuad.topLeft,
			scaledQuad.bottomLeft,
			surfaceStart
		);
		const rightStart = interpolatePoint(
			scaledQuad.topRight,
			scaledQuad.bottomRight,
			surfaceStart
		);
		const leftEnd = interpolatePoint(
			scaledQuad.topLeft,
			scaledQuad.bottomLeft,
			surfaceEnd
		);
		const rightEnd = interpolatePoint(
			scaledQuad.topRight,
			scaledQuad.bottomRight,
			surfaceEnd
		);

		const xVector = {
			x: (rightStart.x - leftStart.x + (rightEnd.x - leftEnd.x)) * 0.5,
			y: (rightStart.y - leftStart.y + (rightEnd.y - leftEnd.y)) * 0.5,
		};
		const yVector = {
			x: (leftEnd.x - leftStart.x + (rightEnd.x - rightStart.x)) * 0.5,
			y: (leftEnd.y - leftStart.y + (rightEnd.y - rightStart.y)) * 0.5,
		};
		const desiredCenter = {
			x: (leftStart.x + rightStart.x + leftEnd.x + rightEnd.x) * 0.25,
			y: (leftStart.y + rightStart.y + leftEnd.y + rightEnd.y) * 0.25,
		};
		const origin = {
			x: desiredCenter.x - (xVector.x + yVector.x) * 0.5,
			y: desiredCenter.y - (xVector.y + yVector.y) * 0.5,
		};

		const signedMiddle = (sourceStart + sourceEnd) * 0.5 * 2 - 1;
		const surfaceShade = 0.76 + Math.cos(signedMiddle * curvature) * 0.24;
		ctx.globalAlpha = (options.opacity ?? 0.72) * surfaceShade;
		ctx.setTransform(
			xVector.x,
			xVector.y,
			yVector.x,
			yVector.y,
			origin.x,
			origin.y
		);
		ctx.drawImage(
			designCanvas,
			0,
			sourceStart * designCanvas.height,
			designCanvas.width,
			(sourceEnd - sourceStart) * designCanvas.height,
			0,
			0,
			1,
			1
		);
	}
	ctx.restore();
}

/**
 * Perspective-warps the design, then uses multiply blending so the original
 * skin lighting and texture remain visible through the virtual ink.
 */
export function compositeDesignOntoCanvas(
	cv: any,
	ctx: CanvasRenderingContext2D,
	canvasWidth: number,
	canvasHeight: number,
	designMat: any,
	quad: TrackedPoints,
	options: CompositeOptions = {}
): void {
	const width = designMat.cols;
	const height = designMat.rows;
	const scaledQuad = scaledTrackedPoints(quad, options.scale ?? 1);
	const quadPoints = [
		scaledQuad.topLeft,
		scaledQuad.topRight,
		scaledQuad.bottomRight,
		scaledQuad.bottomLeft,
	];
	const padding = 4;
	const left = Math.max(
		0,
		Math.floor(Math.min(...quadPoints.map((point) => point.x)) - padding)
	);
	const top = Math.max(
		0,
		Math.floor(Math.min(...quadPoints.map((point) => point.y)) - padding)
	);
	const right = Math.min(
		canvasWidth,
		Math.ceil(Math.max(...quadPoints.map((point) => point.x)) + padding)
	);
	const bottom = Math.min(
		canvasHeight,
		Math.ceil(Math.max(...quadPoints.map((point) => point.y)) + padding)
	);
	const outputWidth = right - left;
	const outputHeight = bottom - top;
	if (outputWidth < 2 || outputHeight < 2) return;

	const source = cv.matFromArray(4, 1, cv.CV_32FC2, [
		0,
		0,
		width,
		0,
		width,
		height,
		0,
		height,
	]);
	const destination = cv.matFromArray(4, 1, cv.CV_32FC2, [
		scaledQuad.topLeft.x - left,
		scaledQuad.topLeft.y - top,
		scaledQuad.topRight.x - left,
		scaledQuad.topRight.y - top,
		scaledQuad.bottomRight.x - left,
		scaledQuad.bottomRight.y - top,
		scaledQuad.bottomLeft.x - left,
		scaledQuad.bottomLeft.y - top,
	]);
	const transform = cv.getPerspectiveTransform(source, destination);
	const warped = new cv.Mat();

	try {
		cv.warpPerspective(
			designMat,
			warped,
			transform,
			new cv.Size(outputWidth, outputHeight),
			cv.INTER_LINEAR,
			cv.BORDER_CONSTANT,
			new cv.Scalar(0, 0, 0, 0)
		);
		const canvas = getTmpCanvas(outputWidth, outputHeight);
		cv.imshow(canvas, warped);
		ctx.save();
		ctx.globalCompositeOperation = "multiply";
		ctx.globalAlpha = options.opacity ?? 0.82;
		ctx.filter = "blur(0.4px)";
		ctx.drawImage(canvas, left, top);
		ctx.restore();
	} finally {
		source.delete();
		destination.delete();
		transform.delete();
		warped.delete();
	}
}
