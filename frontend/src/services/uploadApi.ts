import {
	ALLOWED_IMAGE_TYPES,
	MAX_IMAGE_SIZE,
	type UploadPurpose,
} from "../constants/upload";
import type {
	CompleteUploadRequest,
	ImageResponse,
	PresignedUploadRequest,
	PresignedUploadResponse,
} from "../types/upload";
import { api } from "./api";

export async function createPresignedUpload(
	params: PresignedUploadRequest,
): Promise<PresignedUploadResponse> {
	const { data } = await api.post<PresignedUploadResponse>(
		"/images/uploads/presign",
		params,
	);
	return data;
}

export async function completeUpload(
	body: CompleteUploadRequest,
): Promise<ImageResponse> {
	const { data } = await api.post<ImageResponse>(
		"/images/uploads/complete",
		body,
	);
	return data;
}

/** presign → MinIO PUT → complete 후 imageSeq 반환 */
export async function uploadImage(
	file: File,
	purpose: UploadPurpose,
): Promise<number> {
	if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
		throw new Error("JPG, PNG, WEBP 이미지만 업로드할 수 있습니다.");
	}
	if (file.size > MAX_IMAGE_SIZE) {
		throw new Error("이미지는 최대 10MB까지 업로드할 수 있습니다.");
	}

	const presigned = await createPresignedUpload({
		purpose,
		contentType: file.type as PresignedUploadRequest["contentType"],
		originalFilename: file.name,
		fileSize: file.size,
	});

	const headers = {
		...(presigned.requiredHeaders ?? {}),
		"Content-Type": file.type,
	};

	const res = await fetch(presigned.uploadUrl, {
		method: "PUT",
		headers,
		body: file,
	});
	if (!res.ok) {
		throw new Error("이미지 업로드에 실패했습니다.");
	}

	const image = await completeUpload({ objectKey: presigned.objectKey });
	return image.imageSeq;
}
