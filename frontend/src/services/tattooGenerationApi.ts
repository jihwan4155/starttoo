import { ApiError, api } from "./api";

export type GenerateTattooRequest = {
	prompt: string;
	style: string[];
	seed?: number;
	steps?: number;
	guidance?: number;
	size?: 512 | 768 | 1024;
};

export async function generateTattoo(
	request: GenerateTattooRequest,
): Promise<Blob> {
	try {
		const response = await api.post<Blob>("/tattoos/generate", request, {
			responseType: "blob",
			timeout: 60 * 60 * 1000,
		});
		if (!(response.data instanceof Blob) || response.data.size === 0) {
			throw new ApiError(502, "EMPTY_GENERATION", "생성된 이미지가 없습니다.");
		}
		return response.data;
	} catch (error) {
		if (error instanceof ApiError) {
			if (error.status === 503) {
				throw new Error("AI 생성 서버가 준비 중이거나 사용 중입니다. 잠시 후 다시 시도해주세요.");
			}
			if (error.status === 504 || error.code === "NETWORK") {
				throw new Error("도안 생성 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.");
			}
		}
		throw error;
	}
}
