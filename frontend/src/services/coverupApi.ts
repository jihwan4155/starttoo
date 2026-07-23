import { apiFetch } from "./api";
import { uploadImage } from "./uploadApi";
import demoTattoo from "../assets/images/demo-tattoo.png";
import { DEMO_MODE } from "../constants/config";
import type { CoverupResponse } from "../types/coverup";

// TODO: purpose 값(objectKey prefix 정책)은 백엔드와 협의 후 확정
const COVERUP_UPLOAD_PURPOSE = "COVERUP_IMAGE";

/**
 * 커버업 도안 추천
 * 1) Presigned URL 발급 → MinIO 직접 업로드
 * 2) objectKey로 POST /coverups/recommendations 호출
 */
export async function requestCoverupRecommendation(params: {
	image: File;
}): Promise<CoverupResponse> {
	// 시연용: 백엔드 없이 목업 도안 반환 (생성 연출을 위한 지연 포함)
	if (DEMO_MODE) {
		await new Promise((resolve) => {
			setTimeout(resolve, 1500);
		});
		return { imageUrl: demoTattoo, createdAt: new Date().toISOString() };
	}

	const imageObjectKey = await uploadImage(
		params.image,
		COVERUP_UPLOAD_PURPOSE,
	);

	return apiFetch<CoverupResponse>("/coverups/recommendations", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ imageObjectKey }),
	});
}
