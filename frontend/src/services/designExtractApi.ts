import type { DesignExtractResult } from "../types/designExtract";
import { api } from "./api";

type TattooDesignImageResponse = {
	imageSeq: number;
	downloadUrl: string;
	expiresAt: string;
};

/**
 * 분류 과정에서 미리 저장한 도안 이미지의 Presigned URL을 조회한다.
 * 도안 추출 AI를 다시 호출하지 않는다.
 */
export async function getStoredDesign(
	tattooSeq: number
): Promise<DesignExtractResult> {
	const { data } = await api.get<TattooDesignImageResponse>(
		`/tattoos/${tattooSeq}/image`,
		{ params: { variant: "DESIGN" } }
	);

	return {
		previewUrl: data.downloadUrl,
		downloadUrl: data.downloadUrl,
	};
}
