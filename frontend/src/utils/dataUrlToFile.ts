/** base64 data URL → File (presigned 업로드용) */
export function dataUrlToFile(dataUrl: string, filename: string): File {
	const [header, base64] = dataUrl.split(",");
	const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new File([bytes], filename, { type: mime });
}
