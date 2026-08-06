import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../constants/upload";

/**
 * 업로드한 사진에서 도안을 뽑는 AI 서버 호출.
 *
 * 게시글의 "도안 추출"(designExtractApi)은 글을 올릴 때 분류 과정에서 이미
 * 만들어 둔 도안 이미지를 조회할 뿐이라 tattooSeq가 필요하다. 방금 올린 사진은
 * 백엔드에 그런 엔드포인트가 없어서, nginx가 /ai-service/로 열어 둔 추출 서버에
 * 사진을 그대로 보내고 PNG를 받는다.
 */
const EXTRACT_BASE_URL: string = (
	import.meta.env.VITE_EXTRACT_API_BASE_URL ?? "/ai-service/api/v1"
).replace(/\/+$/, "");

/** AI 서버 오류 본문 — 커스텀 예외는 { error: { code, message } }, FastAPI 기본은 { detail } */
async function readErrorMessage(response: Response): Promise<string> {
	if (response.status === 503) {
		return "도안 추출 서버가 준비 중이거나 다른 작업을 처리하고 있어요. 잠시 후 다시 시도해주세요.";
	}
	try {
		const body: unknown = await response.json();
		if (body != null && typeof body === "object") {
			const envelope = body as {
				error?: { message?: string };
				detail?: unknown;
			};
			if (typeof envelope.error?.message === "string") {
				return envelope.error.message;
			}
			if (typeof envelope.detail === "string") return envelope.detail;
		}
	} catch {
		// JSON이 아니면 아래 기본 문구로 넘어간다
	}
	return `도안 추출에 실패했습니다. (${response.status})`;
}

/**
 * POST {AI}/extract — 타투 사진 1장에서 배경을 지운 도안 PNG를 받는다.
 *
 * @param file JPG·PNG·WEBP 사진
 * @returns 투명 배경 PNG Blob
 */
export async function extractDesignFromPhoto(file: File): Promise<Blob> {
	if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
		throw new Error("JPG, PNG, WEBP 형식만 업로드할 수 있어요.");
	}
	if (file.size > MAX_IMAGE_SIZE) {
		throw new Error("이미지는 최대 10MB까지 업로드할 수 있어요.");
	}

	const form = new FormData();
	form.append("file", file);

	let response: Response;
	try {
		response = await fetch(`${EXTRACT_BASE_URL}/extract?output=transparent`, {
			method: "POST",
			body: form,
		});
	} catch {
		throw new Error("도안 추출 서버에 연결할 수 없습니다.");
	}

	if (!response.ok) throw new Error(await readErrorMessage(response));

	const blob = await response.blob();
	if (blob.size === 0) throw new Error("추출된 도안이 비어 있습니다.");
	return blob;
}
