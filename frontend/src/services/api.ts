import axios, {
	type AxiosError,
	type AxiosInstance,
	type InternalAxiosRequestConfig,
} from "axios";

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

type AuthRetryConfig = InternalAxiosRequestConfig & {
	_retryWithoutAuth?: boolean;
};

/** 공통 axios 인스턴스 — baseURL·JSON 헤더를 기본 설정 */
export const api: AxiosInstance = axios.create({
	baseURL: API_BASE_URL,
	headers: { "Content-Type": "application/json" },
});

// 로그인 후 토큰을 주입할 수 있도록 모듈 레벨에 보관.
let accessToken: string | null = null;
export function setAccessToken(token: string | null): void {
	accessToken = token;
}

/** 401(만료·무효 토큰) 시 세션 초기화 — useAuthStore에서 등록 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void): void {
	onUnauthorized = handler;
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
	(response) => {
		// 백엔드 공통 성공 응답은 { data: ... } 로 감싸여 온다.
		// 여기서 한 번 벗겨야 각 서비스의 반환 타입(payload)과 실제 값이 일치한다.
		// 오류 응답(ErrorResponse)은 평면 구조라 이 분기에 걸리지 않는다.
		const body: unknown = response.data;
		if (body !== null && typeof body === "object" && "data" in body) {
			response.data = (body as { data: unknown }).data;
		}
		return response;
	},
	async (error: AxiosError<{ status: number; code: string; message: string }>) => {
		const config = error.config as AuthRetryConfig | undefined;

		// 공개 GET만 토큰 없이 재시도 (POST/PUT/PATCH/DELETE는 재시도해도 401)
		if (
			error.response?.status === 401 &&
			accessToken &&
			config &&
			!config._retryWithoutAuth &&
			(config.method?.toLowerCase() === "get" ||
				config.method?.toLowerCase() === "head")
		) {
			setAccessToken(null);
			onUnauthorized?.();
			config._retryWithoutAuth = true;
			delete config.headers.Authorization;
			return api.request(config);
		}

		if (error.response) {
			const body = error.response.data;
			const code = body?.code ?? "UNKNOWN";
			const message =
				body?.message ?? `요청에 실패했습니다. (${error.response.status})`;
			return Promise.reject(
				new ApiError(error.response.status, code, message),
			);
		}
		return Promise.reject(
			new ApiError(0, "NETWORK", "서버에 연결할 수 없습니다."),
		);
	},
);
