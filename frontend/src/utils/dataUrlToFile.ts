/** 업로드 허용 MIME → 확장자 (백엔드 MediaService.contentType과 같은 대응) */
const MIME_EXTENSIONS: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

/**
 * base64 data URL → File (presigned 업로드용)
 *
 * 확장자는 호출자가 붙이지 않고 data URL의 MIME에서 뽑는다. presign은 파일명
 * 확장자와 contentType이 같은지 검사해서 어긋나면 INVALID_FILE로 거절하는데,
 * 확장자를 손으로 적으면 캔버스 출력 포맷이 바뀔 때 조용히 틀어진다.
 * 그래서 `basename`은 확장자 없이 넘긴다.
 */
export function dataUrlToFile(dataUrl: string, basename: string): File {
	const [header, base64] = dataUrl.split(",");
	const declared = header.match(/:(.*?);/)?.[1];
	const mime = declared && MIME_EXTENSIONS[declared] ? declared : "image/jpeg";
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new File([bytes], `${basename}.${MIME_EXTENSIONS[mime]}`, {
		type: mime,
	});
}
