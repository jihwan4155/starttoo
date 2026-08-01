import axios, {
	type AxiosError,
	type AxiosInstance,
	type AxiosResponse,
	type InternalAxiosRequestConfig,
} from "axios";

export const API_BASE_URL: string =
	import.meta.env.VITE_API_BASE_URL ??
	(import.meta.env.DEV ? "/v1" : "http://localhost:8080/v1");

/** 백엔드 성공 응답 래퍼 */
export type ApiResponseBody<T> = {
	data: T;
};

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

function unwrapResponseData<T>(response: AxiosResponse<T | ApiResponseBody<T>>): T {
	const body = response.data;
	if (
		body != null &&
		typeof body === "object" &&
		"data" in body &&
		Object.keys(body).length === 1
	) {
		return (body as ApiResponseBody<T>).data;
	}
	return body as T;
}

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

// 로그인·회원가입 요청에는 기존 토큰을 붙이지 않는다.
const AUTH_SKIP_PATHS = [
	"/test/auth/login",
	"/auth/social/login",
	"/auth/signup",
	"/auth/token/refresh",
];

// 모든 요청에 Authorization 헤더 자동 첨부
api.interceptors.request.use((config) => {
	const path = config.url ?? "";
	const skipAuth = AUTH_SKIP_PATHS.some((segment) => path.includes(segment));
	if (accessToken && !skipAuth) {
		config.headers.Authorization = `Bearer ${accessToken}`;
	}
	return config;
});

// 성공 응답 { data: T } unwrap + 에러 통일
api.interceptors.response.use(
	(response) => ({
		...response,
		data: unwrapResponseData(response),
	}),
	// 에러 본문은 { status, code, message } 봉투일 때도, 평문 문자열일 때도 있어
	// unknown으로 받고 아래에서 형태를 확인한다. (좁게 선언하면 문자열 분기가 never가 된다)
	async (error: AxiosError<unknown>) => {
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
			const code =
				typeof body === "object" && body != null && "code" in body
					? String(body.code)
					: "UNKNOWN";
			const message =
				(typeof body === "object" && body != null && "message" in body
					? String(body.message)
					: undefined) ??
				(typeof body === "string" && body.trim().length > 0
					? body.trim()
					: undefined) ??
				`요청에 실패했습니다. (${error.response.status})`;
			return Promise.reject(
				new ApiError(error.response.status, code, message),
			);
		}
		return Promise.reject(
			new ApiError(0, "NETWORK", "서버에 연결할 수 없습니다."),
		);
	},
);
