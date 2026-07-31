import type { UploadPurpose } from "../constants/upload";

/** POST /images/uploads/presign 요청 */
export type PresignedUploadRequest = {
	purpose: UploadPurpose;
	contentType: "image/jpeg" | "image/png" | "image/webp";
	originalFilename: string;
	fileSize: number;
};

/** POST /images/uploads/presign 응답 */
export type PresignedUploadResponse = {
	objectKey: string;
	uploadUrl: string;
	requiredHeaders: Record<string, string>;
	expiresInSeconds: number;
};

/** POST /images/uploads/complete 요청 */
export type CompleteUploadRequest = {
	objectKey: string;
};

/** POST /images/uploads/complete 응답 */
export type ImageResponse = {
	imageSeq: number;
	objectKey: string;
	downloadUrl: string;
	regDttm: string;
};
