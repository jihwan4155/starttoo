/** 원격 이미지 URL → File (보관함·게시글 작성용) */
export async function urlToFile(
	url: string,
	filename: string,
): Promise<File> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error("이미지를 불러오지 못했습니다.");
	}
	const blob = await res.blob();
	return new File([blob], filename, {
		type: blob.type || "image/jpeg",
	});
}
