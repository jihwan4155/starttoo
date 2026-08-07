/**
 * 크롭 상태 — 뷰포트 크기와 무관하게 저장되도록 정규화된 값 사용
 * zoom: 1(꽉 참)~N 배율, offsetX/offsetY: 뷰포트 가로 길이 대비 이동 비율
 */
export type CropState = {
	zoom: number;
	offsetX: number;
	offsetY: number;
};

export const DEFAULT_CROP: CropState = { zoom: 1, offsetX: 0, offsetY: 0 };

/** 게시물 사진 비율 — 세로:가로 = 4:3 (aspect = 가로/세로) */
export const POST_IMAGE_ASPECT = 3 / 4;

/**
 * 이미지가 뷰포트를 cover로 채우는 기본 배율 (뷰포트 가로를 1로 둔 기준)
 * aspect는 뷰포트의 가로/세로 비율.
 */
function coverScaleRatio(
	naturalWidth: number,
	naturalHeight: number,
	aspect: number,
): number {
	if (!naturalWidth || !naturalHeight) return 0;
	return Math.max(1 / naturalWidth, 1 / (aspect * naturalHeight));
}

/** 이미지가 크롭 뷰포트를 벗어나지 않도록 offset을 클램프 */
export function clampCrop(
	crop: CropState,
	naturalWidth: number,
	naturalHeight: number,
	aspect = 1,
): CropState {
	const cover = coverScaleRatio(naturalWidth, naturalHeight, aspect);
	if (!cover) return crop;
	// (표시 크기 - 뷰포트) / 2 를 뷰포트 가로로 나눈 값 = 중심 기준 최대 이동 비율.
	// zoom이 1보다 작으면 사진이 뷰포트보다 작아 이 값이 음수가 된다. 그대로 쓰면
	// 아래 clamp의 상·하한이 뒤집혀 사진이 엉뚱한 곳으로 튀므로 0으로 막는다
	// (움직일 여백이 없으니 가운데 고정이 맞다).
	const maxX = Math.max(0, (naturalWidth * cover * crop.zoom - 1) / 2);
	const maxY = Math.max(0, (naturalHeight * cover * crop.zoom - 1 / aspect) / 2);
	return {
		...crop,
		offsetX: Math.min(maxX, Math.max(-maxX, crop.offsetX)),
		offsetY: Math.min(maxY, Math.max(-maxY, crop.offsetY)),
	};
}

/** 뷰포트 가로를 1로 둔 이미지 표시 배율 (ImageCropper 미리보기용) */
export function previewScale(
	naturalWidth: number,
	naturalHeight: number,
	zoom: number,
	aspect = 1,
): number {
	return coverScaleRatio(naturalWidth, naturalHeight, aspect) * zoom;
}

type CropOutputOptions = {
	/** 결과 이미지의 긴 변 최대 픽셀 */
	outputSize?: number;
	quality?: number;
	/** 잘라낼 비율 (가로/세로) — 기본 정사각형 */
	aspect?: number;
};

/**
 * 크롭 상태를 적용해 지정한 비율로 잘라 base64 데이터 URL로 변환
 * (localStorage 저장용 — outputSize로 축소, JPEG 압축)
 */
export function cropImageToDataUrl(
	file: File,
	crop: CropState,
	{ outputSize = 1080, quality = 0.8, aspect = 1 }: CropOutputOptions = {},
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
				aspect,
			);
			const cover = coverScaleRatio(img.width, img.height, aspect);
			if (!cover) {
				reject(new Error("이미지를 처리할 수 없습니다."));
				return;
			}
			// 원본 좌표계에서 잘라낼 영역 (zoom 배율만큼 축소된 aspect 비율 영역)
			const sourceW = 1 / (cover * zoom);
			const sourceH = sourceW / aspect;
			const sx = img.width / 2 - offsetX * sourceW - sourceW / 2;
			const sy = img.height / 2 - offsetY * sourceW - sourceH / 2;
			const shrink = Math.min(1, outputSize / Math.max(sourceW, sourceH));
			const canvas = document.createElement("canvas");
			canvas.width = Math.max(1, Math.round(sourceW * shrink));
			canvas.height = Math.max(1, Math.round(sourceH * shrink));
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				reject(new Error("이미지를 처리할 수 없습니다."));
				return;
			}
			// zoom이 1보다 작으면 잘라낼 영역이 원본 밖으로 나간다. 그 자리는 투명하게
			// 남는데 JPEG에는 알파가 없어 검게 굳는다. 흰색을 먼저 깔아 여백으로 만든다.
			// (zoom이 1 이상이면 사진이 캔버스를 덮어 이 칠은 보이지 않는다)
			ctx.fillStyle = "#fff";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(
				img,
				sx,
				sy,
				sourceW,
				sourceH,
				0,
				0,
				canvas.width,
				canvas.height,
			);
			resolve(canvas.toDataURL("image/jpeg", quality));
		};
		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error("이미지를 읽을 수 없습니다."));
		};
		img.src = objectUrl;
	});
}
