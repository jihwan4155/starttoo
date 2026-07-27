import { api } from "./api";
import {
	ALLOWED_IMAGE_TYPES,
	MAX_IMAGE_SIZE,
} from "../constants/upload";
import type {
	PresignedUploadRequest,
	PresignedUploadResponse,
} from "../types/upload";

export async function createPresignedUpload(
	params: PresignedUploadRequest,
): Promise<PresignedUploadResponse> {
	const { data } = await api.post<PresignedUploadResponse>(
		"/uploads/presigned-url",
		params,
	);
	return data;
}

/** Presigned URL을 발급받아 MinIO에 직접 업로드하고 objectKey를 반환 */
export async function uploadImage(
	file: File,
	purpose: string,
): Promise<string> {
	if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
		throw new Error("JPG, PNG, WEBP 이미지만 업로드할 수 있습니다.");
	}
	if (file.size > MAX_IMAGE_SIZE) {
		throw new Error("이미지는 최대 10MB까지 업로드할 수 있습니다.");
	}

	const presigned = await createPresignedUpload({
		purpose,
		contentType: file.type as PresignedUploadRequest["contentType"],
		fileSize: file.size,
	});

	const res = await fetch(presigned.uploadUrl, {
		method: presigned.method || "PUT",
		headers: { "Content-Type": presigned.contentType },
		body: file,
	});
	if (!res.ok) {
		throw new Error("이미지 업로드에 실패했습니다.");
	}

	return presigned.objectKey;
}
