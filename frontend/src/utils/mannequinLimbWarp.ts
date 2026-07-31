import type { PersonMask } from "../components/simulation/inkproof/image-engine";
import {
	isPixelPartAllowed,
	resolvePartClipRule,
	type MannequinPartId,
	type MannequinPartMask,
	type PartClipRule,
} from "./mannequinPartIds";

export type MannequinPlacement = {
	x: number;
	y: number;
	scale: number;
	rotation: number;
	bodyPart: string;
	flipX?: boolean;
};

export type MannequinRenderQuality = "draft" | "final";

const RENDER_PRESETS: Record<
	MannequinRenderQuality,
	{ scale: number; columns: number }
> = {
	draft: { scale: 1.25, columns: 28 },
	final: { scale: 2.5, columns: 56 },
};

function clamp(value: number, min = 0, max = 1) {
	return Math.min(max, Math.max(min, value));
}

function smoothStep(edge0: number, edge1: number, value: number) {
	const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
	return t * t * (3 - 2 * t);
}

function rotatePoint(x: number, y: number, angleRad: number) {
	const cos = Math.cos(angleRad);
	const sin = Math.sin(angleRad);
	return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/** 회전 타원 footprint — 도안 영역 안쪽 가중치 (0~1) */
function getTattooFootprintWeight(
	canvasX: number,
	canvasY: number,
	centerX: number,
	centerY: number,
	halfW: number,
	halfH: number,
	rotationRad: number,
) {
	const local = rotatePoint(canvasX - centerX, canvasY - centerY, -rotationRad);
	const radial = Math.hypot(
		local.x / Math.max(1, halfW),
		local.y / Math.max(1, halfH),
	);
	const inner = 0.88;
	const outer = 1.22;
	if (radial >= outer) return 0;
	if (radial <= inner) return 1;
	return 1 - smoothStep(inner, outer, radial);
}

/**
 * 몸 실루엣 ∩ 회전 도안 footprint
 * 경계가 마네킹 PNG 곡선을 따라감
 */
export function buildSilhouetteClipMask(
	bodyMask: PersonMask,
	partMask: MannequinPartMask,
	placement: MannequinPlacement,
	tattooAspect: number,
	canvasWidth: number,
	canvasHeight: number,
): PersonMask {
	const { width, height, data } = bodyMask;
	const regional = new Float32Array(data.length);
	const centerX = placement.x * canvasWidth;
	const centerY = placement.y * canvasHeight;
	const halfW = (placement.scale * canvasWidth) / 2;
	const halfH = halfW * tattooAspect;
	const rotationRad = (placement.rotation * Math.PI) / 180;
	const padW = halfW * 1.18;
	const padH = halfH * 1.18;
	const scaleX = width / canvasWidth;
	const scaleY = height / canvasHeight;
	const clipRule = resolvePartClipRule(
		partMask,
		placement,
		canvasWidth,
		canvasHeight,
		tattooAspect,
	);

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const index = y * width + x;
			const bodyAlpha = data[index];
			if (bodyAlpha < 0.06) continue;

			const pixelPart = partMask.data[index] as MannequinPartId;
			if (!isPixelPartAllowed(pixelPart, clipRule)) continue;

			const canvasX = (x + 0.5) / scaleX;
			const canvasY = (y + 0.5) / scaleY;
			const footprint = getTattooFootprintWeight(
				canvasX,
				canvasY,
				centerX,
				centerY,
				padW,
				padH,
				rotationRad,
			);
			if (footprint <= 0) continue;

			regional[index] = bodyAlpha * footprint;
		}
	}

	return maskFromFloatData(regional, width, height);
}

function maskFromFloatData(data: Float32Array, width: number, height: number): PersonMask {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Canvas 2D context를 만들 수 없습니다.");
	}

	const imageData = context.createImageData(width, height);
	let covered = 0;
	for (let index = 0; index < data.length; index += 1) {
		const alpha = data[index];
		if (alpha > 0.12) covered += 1;
		const offset = index * 4;
		imageData.data[offset] = 255;
		imageData.data[offset + 1] = 255;
		imageData.data[offset + 2] = 255;
		imageData.data[offset + 3] = Math.round(clamp(alpha) * 255);
	}
	context.putImageData(imageData, 0, 0);

	return {
		canvas,
		data,
		width,
		height,
		coverage: covered / Math.max(1, data.length),
		engine: "local-silhouette",
		detail: "마네킹 실루엣 클립",
	};
}

function mapTriangle(
	context: CanvasRenderingContext2D,
	image: HTMLCanvasElement,
	source: Array<{ x: number; y: number }>,
	destination: Array<{ x: number; y: number }>,
) {
	const [s0, s1, s2] = source;
	const [d0, d1, d2] = destination;
	const determinant =
		s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
	if (Math.abs(determinant) < 0.0001) return;

	const a =
		(d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) /
		determinant;
	const c =
		(d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) /
		determinant;
	const e =
		(d0.x * (s1.x * s2.y - s2.x * s1.y) +
			d1.x * (s2.x * s0.y - s0.x * s2.y) +
			d2.x * (s0.x * s1.y - s1.x * s0.y)) /
		determinant;
	const b =
		(d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) /
		determinant;
	const d =
		(d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) /
		determinant;
	const f =
		(d0.y * (s1.x * s2.y - s2.x * s1.y) +
			d1.y * (s2.x * s0.y - s0.x * s2.y) +
			d2.y * (s0.x * s1.y - s1.x * s0.y)) /
		determinant;

	context.save();
	context.beginPath();
	context.moveTo(d0.x, d0.y);
	context.lineTo(d1.x, d1.y);
	context.lineTo(d2.x, d2.y);
	context.closePath();
	context.clip();
	context.transform(a, b, c, d, e, f);
	context.drawImage(image, 0, 0);
	context.restore();
}

function getLocalCrossSection(
	mask: PersonMask,
	partMask: MannequinPartMask,
	clipRule: PartClipRule,
	canvasWidth: number,
	canvasHeight: number,
	centerX: number,
	centerY: number,
	wrapX: number,
	wrapY: number,
	footprintCenterX: number,
	footprintCenterY: number,
	padW: number,
	padH: number,
	rotationRad: number,
) {
	const scaleX = mask.width / canvasWidth;
	const scaleY = mask.height / canvasHeight;
	const samples: number[] = [];
	const step = Math.max(1, Math.min(canvasWidth, canvasHeight) / 120);
	const maxDistance = Math.min(canvasWidth, canvasHeight) * 0.24;

	for (let distance = -maxDistance; distance <= maxDistance; distance += step) {
		const px = centerX + wrapX * distance;
		const py = centerY + wrapY * distance;
		if (px < 0 || py < 0 || px >= canvasWidth || py >= canvasHeight) continue;

		const footprint = getTattooFootprintWeight(
			px,
			py,
			footprintCenterX,
			footprintCenterY,
			padW,
			padH,
			rotationRad,
		);
		if (footprint <= 0) continue;

		const maskX = Math.min(
			mask.width - 1,
			Math.max(0, Math.round(px * scaleX)),
		);
		const maskY = Math.min(
			mask.height - 1,
			Math.max(0, Math.round(py * scaleY)),
		);
		const index = maskY * mask.width + maskX;
		if (mask.data[index] < 0.12) continue;
		if (
			!isPixelPartAllowed(
				partMask.data[index] as MannequinPartId,
				clipRule,
			)
		) {
			continue;
		}

		samples.push(distance);
	}

	if (samples.length === 0) return null;

	const midpoint = (Math.min(...samples) + Math.max(...samples)) / 2;
	const radius = Math.max(6, (Math.max(...samples) - Math.min(...samples)) / 2);
	return { midpoint, radius };
}

/** 마네킹 전용 — 실루엣 + 원통형 워프 */
export function drawMannequinLimbWarp(
	target: CanvasRenderingContext2D,
	canvasWidth: number,
	canvasHeight: number,
	tattoo: HTMLCanvasElement,
	bodyMask: PersonMask,
	partMask: MannequinPartMask,
	placement: MannequinPlacement,
	quality: MannequinRenderQuality = "final",
) {
	const rotationRad = (placement.rotation * Math.PI) / 180;
	const tattooWidth = placement.scale * canvasWidth;
	const tattooHeight = tattooWidth * (tattoo.height / tattoo.width);
	const center = {
		x: placement.x * canvasWidth,
		y: placement.y * canvasHeight,
	};
	const padW = (tattooWidth / 2) * 1.18;
	const padH = (tattooHeight / 2) * 1.18;
	const tattooAspect = tattoo.height / tattoo.width;
	const clipRule = resolvePartClipRule(
		partMask,
		placement,
		canvasWidth,
		canvasHeight,
		tattooAspect,
	);

	const wrapDirection = rotatePoint(1, 0, rotationRad);
	const axisDirection = rotatePoint(0, 1, rotationRad);
	const columns = RENDER_PRESETS[quality].columns;
	const rows = Math.max(
		28,
		Math.round(columns * (tattooHeight / Math.max(1, tattooWidth))),
	);
	const vertices: Array<{ x: number; y: number }> = [];

	target.imageSmoothingEnabled = true;
	target.imageSmoothingQuality = "high";

	for (let row = 0; row <= rows; row += 1) {
		const localY = (row / rows - 0.5) * tattooHeight;
		const rowCenter = {
			x: center.x + axisDirection.x * localY,
			y: center.y + axisDirection.y * localY,
		};

		const crossSection = getLocalCrossSection(
			bodyMask,
			partMask,
			clipRule,
			canvasWidth,
			canvasHeight,
			rowCenter.x,
			rowCenter.y,
			wrapDirection.x,
			wrapDirection.y,
			center.x,
			center.y,
			padW,
			padH,
			rotationRad,
		);

		for (let column = 0; column <= columns; column += 1) {
			const localX = (column / columns - 0.5) * tattooWidth;
			let mappedX = localX;

			if (crossSection && crossSection.radius > 2) {
				const centeredAcross = localX - crossSection.midpoint;
				const normalizedAcross = centeredAcross / crossSection.radius;
				const absoluteAcross = Math.abs(normalizedAcross);

				if (absoluteAcross <= 1.15) {
					const projectedAcross =
						crossSection.midpoint +
						Math.sin(clamp(normalizedAcross, -1, 1) * Math.PI * 0.5) *
							crossSection.radius;
					const edgeInfluence = 1 - smoothStep(0.05, 0.65, 1 - absoluteAcross);
					const shift = (projectedAcross - localX) * edgeInfluence * 0.75;
					mappedX = localX + shift;
				}
			}

			const foreshortening = 1 - 0.06 * Math.abs(mappedX / Math.max(1, tattooWidth));
			vertices.push({
				x:
					center.x +
					axisDirection.x * localY +
					wrapDirection.x * mappedX * foreshortening,
				y:
					center.y +
					axisDirection.y * localY +
					wrapDirection.y * mappedX * foreshortening,
			});
		}
	}

	const vertex = (column: number, row: number) =>
		vertices[row * (columns + 1) + column];

	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			const p00 = vertex(column, row);
			const p10 = vertex(column + 1, row);
			const p01 = vertex(column, row + 1);
			const p11 = vertex(column + 1, row + 1);

			const sx0 = (column / columns) * tattoo.width;
			const sx1 = ((column + 1) / columns) * tattoo.width;
			const sy0 = (row / rows) * tattoo.height;
			const sy1 = ((row + 1) / rows) * tattoo.height;

			mapTriangle(
				target,
				tattoo,
				[
					{ x: sx0, y: sy0 },
					{ x: sx1, y: sy0 },
					{ x: sx1, y: sy1 },
				],
				[p00, p10, p11],
			);
			mapTriangle(
				target,
				tattoo,
				[
					{ x: sx0, y: sy0 },
					{ x: sx1, y: sy1 },
					{ x: sx0, y: sy1 },
				],
				[p00, p11, p01],
			);
		}
	}
}

export function renderMannequinTattooLayer(
	canvas: HTMLCanvasElement,
	tattoo: HTMLCanvasElement,
	bodyMask: PersonMask,
	partMask: MannequinPartMask,
	placement: MannequinPlacement,
	quality: MannequinRenderQuality = "final",
) {
	const canvasWidth = canvas.width;
	const canvasHeight = canvas.height;
	const context = canvas.getContext("2d");
	if (!context) return;

	context.clearRect(0, 0, canvasWidth, canvasHeight);

	const tattooAspect = tattoo.height / tattoo.width;

	const clipMask = buildSilhouetteClipMask(
		bodyMask,
		partMask,
		placement,
		tattooAspect,
		canvasWidth,
		canvasHeight,
	);

	drawMannequinLimbWarp(
		context,
		canvasWidth,
		canvasHeight,
		tattoo,
		bodyMask,
		partMask,
		placement,
		quality,
	);

	context.save();
	context.globalCompositeOperation = "destination-in";
	context.drawImage(clipMask.canvas, 0, 0, canvasWidth, canvasHeight);
	context.restore();
}

export function getMannequinRenderScale(
	quality: MannequinRenderQuality = "final",
) {
	return RENDER_PRESETS[quality].scale;
}
