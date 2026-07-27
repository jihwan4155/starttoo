import axios, { type AxiosError, type AxiosInstance } from "axios";

export const API_BASE_URL: string =
	import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/v1";

/** 백엔드 공통 에러 응답: { status, code, message } */
export class ApiError extends Error {
	readonly status: number;

	readonly code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
	}
}

/** 공통 axios 인스턴스 — baseURL·JSON 헤더를 기본 설정 */
export const api: AxiosInstance = axios.create({
	baseURL: API_BASE_URL,
	headers: { "Content-Type": "application/json" },
});

// 로그인 후 토큰을 주입할 수 있도록 모듈 레벨에 보관.
// TODO: 인증 스토어에서 로그인/토큰 재발급 시 setAccessToken 호출
let accessToken: string | null = null;
export function setAccessToken(token: string | null): void {
	accessToken = token;
}

// 모든 요청에 Authorization 헤더 자동 첨부
api.interceptors.request.use((config) => {
	if (accessToken) {
		config.headers.Authorization = `Bearer ${accessToken}`;
	}
	return config;
});

// 응답 에러를 기존 ApiError 형태로 통일 (호출부의 catch 로직 유지)
api.interceptors.response.use(
	(response) => response,
	(error: AxiosError<{ status: number; code: string; message: string }>) => {
		if (error.response) {
			const body = error.response.data;
			const code = body?.code ?? "UNKNOWN";
			const message =
				body?.message ?? `요청에 실패했습니다. (${error.response.status})`;
			return Promise.reject(
				new ApiError(error.response.status, code, message),
			);
		}
		// 응답 자체가 없는 경우(네트워크 오류·타임아웃 등)
		return Promise.reject(
			new ApiError(0, "NETWORK", "서버에 연결할 수 없습니다."),
		);
	},
);
