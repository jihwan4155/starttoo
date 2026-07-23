/** POST /uploads/presigned-url 요청 */
export type PresignedUploadRequest = {
	/** 업로드 용도. 서버가 objectKey prefix와 정책을 결정하는 데 사용 (예: POST_IMAGE) */
	purpose: string;
	contentType: "image/jpeg" | "image/png" | "image/webp";
	/** 파일 크기(byte), 최대 10MB */
	fileSize?: number;
};

/** POST /uploads/presigned-url 응답 */
export type PresignedUploadResponse = {
	objectKey: string;
	uploadUrl: string;
	method: string;
	contentType: string;
	expiresAt: string;
};
