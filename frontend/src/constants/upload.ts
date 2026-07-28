/** 업로드 허용 이미지 MIME (백엔드 PresignedUploadRequest.contentType enum) */
export const ALLOWED_IMAGE_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;

/** 업로드 최대 파일 크기 10MB (백엔드 fileSize maximum) */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** POST /uploads/presigned-url — 프로필 이미지 (objectKey: users/{userId}/profile/...) */
export const PROFILE_UPLOAD_PURPOSE = "PROFILE_IMAGE";
