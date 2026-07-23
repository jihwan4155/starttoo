import type {
	DesignExtractResponse,
	DesignExtractResult,
} from "../types/designExtract";

// 도안 추출(이미지 변환) 로컬 서버 주소
const EXTRACT_API_BASE_URL: string =
	import.meta.env.VITE_EXTRACT_API_BASE_URL ?? "http://127.0.0.1:8791";

// 결과 outputs 중 사용할 도안 id
const ORIGINAL_COLOR_OUTPUT_ID = "original_color";

/**
 * 게시글 이미지로 타투 도안 추출
 * 1) 이미지 URL을 blob으로 받아 File 생성
 * 2) FormData로 POST /api/convert 호출
 * 3) original_color 결과의 preview/download URL 반환
 */
export async function extractDesign(imageUrl: string): Promise<DesignExtractResult> {
	const imageRes = await fetch(imageUrl);
	if (!imageRes.ok) {
		throw new Error("게시글 이미지를 불러오지 못했습니다.");
	}
	const blob = await imageRes.blob();
	const file = new File([blob], "post-image.png", {
		type: blob.type || "image/png",
	});

	const form = new FormData();
	form.append("image", file);

	const res = await fetch(`${EXTRACT_API_BASE_URL}/api/convert`, {
		method: "POST",
		body: form,
	});
	if (!res.ok) {
		throw new Error(`도안 추출에 실패했습니다. (${res.status})`);
	}

	const data = (await res.json()) as DesignExtractResponse;
	if (!data.ok) {
		throw new Error("도안 추출에 실패했습니다.");
	}

	const original = data.outputs.find((o) => o.id === ORIGINAL_COLOR_OUTPUT_ID);
	if (!original) {
		throw new Error("도안 추출 결과가 없습니다.");
	}

	return {
		previewUrl: `${EXTRACT_API_BASE_URL}${original.preview_url}`,
		downloadUrl: `${EXTRACT_API_BASE_URL}${original.download_url}`,
	};
}
