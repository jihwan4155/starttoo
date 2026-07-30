import type {
	DepthMap,
	PersonMask,
} from "../components/simulation/inkproof/image-engine";
import {
	decodePartIdFromPixel,
	type MannequinPartMask,
} from "./mannequinPartIds";
import type { MannequinView } from "../types/collection";
import { MANNEQUIN_PART_MASKS } from "../constants/mannequinAssets";

export type MannequinSurface = {
	body: HTMLImageElement;
	personMask: PersonMask;
	partMask: MannequinPartMask;
	depth: DepthMap;
};

const surfaceCache = new Map<string, Promise<MannequinSurface>>();
const imageCache = new Map<string, Promise<HTMLImageElement>>();

const MANNEQUIN_MASK_THRESHOLD = 0.42;

function clamp(value: number, min = 0, max = 1) {
	return Math.min(max, Math.max(min, value));
}

function smoothStep(edge0: number, edge1: number, value: number) {
	const normalized = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
	return normalized * normalized * (3 - 2 * normalized);
}

function loadImage(src: string) {
	const cached = imageCache.get(src);
	if (cached) return cached;

	const promise = new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error("마네킹 이미지를 불러오지 못했습니다."));
		image.src = src;
	});
	imageCache.set(src, promise);
	return promise;
}

function drawImageContain(
	image: HTMLImageElement,
	width: number,
	height: number,
) {
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(width));
	canvas.height = Math.max(1, Math.round(height));
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Canvas 2D context를 만들 수 없습니다.");
	}

	const scale = Math.min(
		canvas.width / Math.max(1, image.naturalWidth),
		canvas.height / Math.max(1, image.naturalHeight),
	);
	const drawWidth = image.naturalWidth * scale;
	const drawHeight = image.naturalHeight * scale;
	const offsetX = (canvas.width - drawWidth) / 2;
	const offsetY = (canvas.height - drawHeight) / 2;
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
	return canvas;
}

function buildPartMaskFromCanvas(source: HTMLCanvasElement): MannequinPartMask {
	const { width, height } = source;
	const context = source.getContext("2d");
	if (!context) {
		throw new Error("Canvas 2D context를 만들 수 없습니다.");
	}

	const pixels = context.getImageData(0, 0, width, height).data;
	const data = new Uint8Array(width * height);
	for (let index = 0; index < data.length; index += 1) {
		const offset = index * 4;
		if (pixels[offset + 3] < 128) {
			data[index] = 0;
			continue;
		}
		data[index] = decodePartIdFromPixel(
			pixels[offset],
			pixels[offset + 1],
			pixels[offset + 2],
		);
	}

	return { canvas: source, data, width, height };
}

function buildPersonMaskFromCanvas(
	source: HTMLCanvasElement,
): PersonMask {
	const { width, height } = source;
	const context = source.getContext("2d");
	if (!context) {
		throw new Error("Canvas 2D context를 만들 수 없습니다.");
	}

	const pixels = context.getImageData(0, 0, width, height).data;
	const scores = new Float32Array(width * height);
	let covered = 0;

	for (let index = 0; index < scores.length; index += 1) {
		const offset = index * 4;
		const alpha = pixels[offset + 3] / 255;
		const red = pixels[offset];
		const green = pixels[offset + 1];
		const blue = pixels[offset + 2];
		const luminance = (red + green + blue) / 765;
		const score =
			alpha > 0.08 && luminance < 0.985
				? clamp(alpha * 1.05)
				: 0;
		scores[index] = score;
	}

	const data = new Float32Array(scores.length);
	const maskCanvas = document.createElement("canvas");
	maskCanvas.width = width;
	maskCanvas.height = height;
	const maskContext = maskCanvas.getContext("2d");
	if (!maskContext) {
		throw new Error("Canvas 2D context를 만들 수 없습니다.");
	}
	const imageData = maskContext.createImageData(width, height);

	for (let index = 0; index < scores.length; index += 1) {
		const alpha = smoothStep(0.18, 0.62, scores[index]);
		data[index] = alpha;
		if (alpha > 0.12) covered += 1;
		const offset = index * 4;
		imageData.data[offset] = 255;
		imageData.data[offset + 1] = 255;
		imageData.data[offset + 2] = 255;
		imageData.data[offset + 3] = Math.round(alpha * 255);
	}

	maskContext.putImageData(imageData, 0, 0);

	return {
		canvas: maskCanvas,
		data,
		width,
		height,
		coverage: covered / Math.max(1, data.length),
		engine: "local-silhouette",
		detail: "마네킹 PNG 실루엣",
	};
}

/** 행별 몸통 단면 → 원통형 깊이 (3d_simul 원뿔대 투영용) */
function buildSyntheticDepth(mask: PersonMask): DepthMap {
	const { width, height, data } = mask;
	const depthData = new Float32Array(width * height);
	const rowCenter = new Float32Array(height);
	const rowRadius = new Float32Array(height);

	for (let y = 0; y < height; y += 1) {
		let minX = width;
		let maxX = -1;
		for (let x = 0; x < width; x += 1) {
			if (data[y * width + x] > MANNEQUIN_MASK_THRESHOLD) {
				minX = Math.min(minX, x);
				maxX = Math.max(maxX, x);
			}
		}
		if (maxX >= minX) {
			rowCenter[y] = (minX + maxX) / 2;
			rowRadius[y] = Math.max(2, (maxX - minX) / 2);
		} else {
			rowCenter[y] = width / 2;
			rowRadius[y] = width * 0.08;
		}
	}

	for (let y = 1; y < height - 1; y += 1) {
		rowCenter[y] =
			rowCenter[y - 1] * 0.2 + rowCenter[y] * 0.6 + rowCenter[y + 1] * 0.2;
		rowRadius[y] =
			rowRadius[y - 1] * 0.22 + rowRadius[y] * 0.56 + rowRadius[y + 1] * 0.22;
	}

	for (let y = 0; y < height; y += 1) {
		const normalizedY = y / Math.max(1, height - 1);
		const torsoBulge =
			0.07 * Math.exp(-Math.pow((normalizedY - 0.36) / 0.2, 2));
		const shoulderBulge =
			0.04 * Math.exp(-Math.pow((normalizedY - 0.22) / 0.12, 2));

		for (let x = 0; x < width; x += 1) {
			const index = y * width + x;
			if (data[index] < 0.12) {
				depthData[index] = 0;
				continue;
			}

			const across = (x - rowCenter[y]) / rowRadius[y];
			const cylindrical = Math.sqrt(
				Math.max(0, 1 - across * across * 0.9),
			);
			depthData[index] = clamp(
				0.26 + cylindrical * 0.5 + torsoBulge + shoulderBulge,
				0,
				1,
			);
		}
	}

	return {
		data: depthData,
		width,
		height,
		engine: "local-fallback",
		detail: "마네킹 원통형 합성 깊이",
	};
}

async function buildMannequinSurface(
	src: string,
	view: MannequinView,
	width: number,
	height: number,
): Promise<MannequinSurface> {
	const partMaskSrc = MANNEQUIN_PART_MASKS[view];
	const body = await loadImage(src);
	const partMaskImage = await loadImage(partMaskSrc);
	const fitted = drawImageContain(body, width, height);
	const fittedParts = drawImageContain(partMaskImage, width, height);
	const personMask = buildPersonMaskFromCanvas(fitted);
	const partMask = buildPartMaskFromCanvas(fittedParts);
	const depth = buildSyntheticDepth(personMask);
	return { body, personMask, partMask, depth };
}

/** 표시 크기에 맞춘 마네킹 마스크·부위 마스크·합성 깊이 (캐시) */
export function getMannequinSurface(
	src: string,
	view: MannequinView,
	width: number,
	height: number,
): Promise<MannequinSurface> {
	if (width <= 0 || height <= 0) {
		return Promise.reject(new Error("유효하지 않은 캔버스 크기입니다."));
	}

	const key = `${src}|${view}@${Math.round(width)}x${Math.round(height)}`;
	const cached = surfaceCache.get(key);
	if (cached) return cached;

	const promise = buildMannequinSurface(src, view, width, height);
	surfaceCache.set(key, promise);
	return promise;
}

const tattooCanvasCache = new Map<string, Promise<HTMLCanvasElement>>();

export function loadTattooCanvas(url: string, flipX = false) {
	const key = `${url}|flip:${flipX}`;
	const cached = tattooCanvasCache.get(key);
	if (cached) return cached;

	const promise = new Promise<HTMLCanvasElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = Math.max(1, image.naturalWidth);
			canvas.height = Math.max(1, image.naturalHeight);
			const context = canvas.getContext("2d");
			if (!context) {
				reject(new Error("Canvas 2D context를 만들 수 없습니다."));
				return;
			}
			if (flipX) {
				context.translate(canvas.width, 0);
				context.scale(-1, 1);
			}
			context.drawImage(image, 0, 0);
			resolve(canvas);
		};
		image.onerror = () => reject(new Error("도안 이미지를 불러오지 못했습니다."));
		image.src = url;
	});

	tattooCanvasCache.set(key, promise);
	return promise;
}

export function placementToTattooTransform(placement: {
	x: number;
	y: number;
	scale: number;
	rotation: number;
}) {
	return {
		x: placement.x,
		y: placement.y,
		width: placement.scale,
		rotation: (placement.rotation * Math.PI) / 180,
	};
}

/** 3d_simul 기본값과 동일 */
export const MANNEQUIN_WARP_CURVATURE = 0.82;
