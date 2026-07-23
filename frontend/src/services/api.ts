export const API_BASE_URL: string =
	import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/v1";

/** 백엔드 공통 에러 응답: { status, code, message } */
export class ApiError extends Error {
	readonly status: number;

	readonly code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

// 로그인 로직 없이 모든 페이지·기능에 접근 가능 (토큰 미사용)
export async function apiFetch<T>(
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const res = await fetch(`${API_BASE_URL}${path}`, init);

	if (!res.ok) {
		let code = "UNKNOWN";
		let message = `요청에 실패했습니다. (${res.status})`;
		try {
			const body = (await res.json()) as {
				status: number;
				code: string;
				message: string;
			};
			code = body.code ?? code;
			message = body.message ?? message;
		} catch {
			// 에러 본문이 JSON이 아니면 기본 메시지 사용
		}
		throw new ApiError(res.status, code, message);
	}

	if (res.status === 204) return undefined as T;
	return res.json() as Promise<T>;
}
