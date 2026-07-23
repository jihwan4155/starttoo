/**
 * 정사각형 크롭 상태 — 뷰포트 크기와 무관하게 저장되도록 정규화된 값 사용
 * zoom: 1(꽉 참)~N 배율, offsetX/offsetY: 뷰포트 한 변 대비 이동 비율
 */
export type CropState = {
	zoom: number;
	offsetX: number;
	offsetY: number;
};

export const DEFAULT_CROP: CropState = { zoom: 1, offsetX: 0, offsetY: 0 };

/** 이미지가 크롭 뷰포트를 벗어나지 않도록 offset을 클램프 */
export function clampCrop(
	crop: CropState,
	naturalWidth: number,
	naturalHeight: number,
): CropState {
	const minSide = Math.min(naturalWidth, naturalHeight);
	if (!minSide) return crop;
	// (표시 크기 / 뷰포트 - 1) / 2 = 중심 기준 최대 이동 비율
	const maxX = ((naturalWidth / minSide) * crop.zoom - 1) / 2;
	const maxY = ((naturalHeight / minSide) * crop.zoom - 1) / 2;
	return {
		...crop,
		offsetX: Math.min(maxX, Math.max(-maxX, crop.offsetX)),
		offsetY: Math.min(maxY, Math.max(-maxY, crop.offsetY)),
	};
}

/**
 * 크롭 상태를 적용해 정사각형으로 잘라 base64 데이터 URL로 변환
 * (localStorage 저장용 — outputSize로 축소, JPEG 압축)
 */
export function cropImageToDataUrl(
	file: File,
	crop: CropState,
	outputSize = 1080,
	quality = 0.8,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);
		img.onload = () => {
			URL.revokeObjectURL(objectUrl);
			const { zoom, offsetX, offsetY } = clampCrop(
				crop,
				img.width,
				img.height,
			);
			const minSide = Math.min(img.width, img.height);
			// 원본 좌표계에서 잘라낼 정사각형 (zoom 배율만큼 축소된 영역)
			const cropSize = minSide / zoom;
			const sx = img.width / 2 - (offsetX * minSide) / zoom - cropSize / 2;
			const sy = img.height / 2 - (offsetY * minSide) / zoom - cropSize / 2;
			const size = Math.round(Math.min(outputSize, cropSize));
			const canvas = document.createElement("canvas");
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				reject(new Error("이미지를 처리할 수 없습니다."));
				return;
			}
			ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, size, size);
			resolve(canvas.toDataURL("image/jpeg", quality));
		};
		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error("이미지를 읽을 수 없습니다."));
		};
		img.src = objectUrl;
	});
}
