/** 업로드 허용 이미지 MIME (백엔드 PresignUploadRequest.contentType) */
export const ALLOWED_IMAGE_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;

/** 업로드 최대 파일 크기 10MB */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** POST /images/uploads/presign — UploadPurpose enum */
export type UploadPurpose =
	| "PROFILE"
	| "POST"
	| "DM"
	| "COLLECTION"
	| "EXTRACTION"
	| "AI_REFERENCE";

export const PROFILE_UPLOAD_PURPOSE: UploadPurpose = "PROFILE";
export const POST_UPLOAD_PURPOSE: UploadPurpose = "POST";
export const DM_UPLOAD_PURPOSE: UploadPurpose = "DM";
export const AI_REFERENCE_UPLOAD_PURPOSE: UploadPurpose = "AI_REFERENCE";
