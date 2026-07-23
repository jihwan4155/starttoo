/**
 * 이미지 파일을 리사이즈·압축해 base64 데이터 URL로 변환
 * (localStorage 저장용 — 긴 변 기준 maxSize로 축소, JPEG 압축)
 */
export function compressImageToDataUrl(
	file: File,
	maxSize = 1080,
	quality = 0.8,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);
		img.onload = () => {
			URL.revokeObjectURL(objectUrl);
			const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
			const canvas = document.createElement("canvas");
			canvas.width = Math.round(img.width * scale);
			canvas.height = Math.round(img.height * scale);
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				reject(new Error("이미지를 처리할 수 없습니다."));
				return;
			}
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
			resolve(canvas.toDataURL("image/jpeg", quality));
		};
		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error("이미지를 읽을 수 없습니다."));
		};
		img.src = objectUrl;
	});
}
