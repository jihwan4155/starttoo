import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../constants/upload";
import type { DesignExtractResult } from "../types/designExtract";
import { api, ApiError } from "./api";
import { uploadImage } from "./uploadApi";

type ExtractTattooResponse = {
	tattooSeq: number;
	designImageSeq: number;
	designImageUrl: string;
};

export class TattooNotDetectedError extends Error {
	constructor() {
		super("타투를 검출할 수 없는 이미지입니다.");
		this.name = "TattooNotDetectedError";
	}
}

/**
 * 원본을 MinIO에 올린 뒤 백엔드가 AI 판정·추출·DB 등록을 한 번에 처리한다.
 * 브라우저가 내부 AI 서버나 내부 인증 토큰에 직접 접근하지 않는다.
 */
export async function extractDesignFromPhoto(
	file: File,
): Promise<DesignExtractResult> {
	if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
		throw new Error("JPG, PNG, WEBP 형식만 업로드할 수 있어요.");
	}
	if (file.size > MAX_IMAGE_SIZE) {
		throw new Error("이미지는 최대 10MB까지 업로드할 수 있어요.");
	}

	try {
		const imageSeq = await uploadImage(file, "EXTRACTION");
		const { data } = await api.post<ExtractTattooResponse>("/tattoos/extract", {
			imageSeq,
		});
		return {
			tattooSeq: data.tattooSeq,
			imageSeq: data.designImageSeq,
			previewUrl: data.designImageUrl,
			downloadUrl: data.designImageUrl,
		};
	} catch (error) {
		if (error instanceof ApiError && error.code === "NOT_TATTOO_IMAGE") {
			throw new TattooNotDetectedError();
		}
		if (error instanceof ApiError && error.status === 503) {
			throw new Error(
				"도안 추출 서버가 다른 작업을 처리하고 있어요. 잠시 후 다시 시도해주세요.",
			);
		}
		throw error;
	}
}
