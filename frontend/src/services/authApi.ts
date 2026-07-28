import { api } from "./api";
import type { PresignedUploadResponse } from "../types/upload";
import type {
	LogoutRequest,
	NicknameAvailabilityResponse,
	NicknameSuggestionResponse,
	RefreshRequest,
	RefreshResponse,
	SignupProfileUploadRequest,
	SignupRequest,
	SocialLoginRequest,
	SocialLoginResponse,
	TestLoginRequest,
	TestLoginResponse,
	TokenResponse,
} from "../types/auth";

/** POST /auth/social/login — 카카오·구글 소셜 로그인 */
export async function socialLogin(
	body: SocialLoginRequest,
): Promise<SocialLoginResponse> {
	const { data } = await api.post<SocialLoginResponse>(
		"/auth/social/login",
		body,
	);
	return data;
}

/** POST /auth/signup — 역할 기반 회원가입 */
export async function signup(body: SignupRequest): Promise<TokenResponse> {
	const { data } = await api.post<TokenResponse>("/auth/signup", body);
	return data;
}

/** POST /auth/signup/profile-image/presigned-url — 회원가입 프로필 이미지 Presigned URL */
export async function createSignupProfileUpload(
	body: SignupProfileUploadRequest,
): Promise<PresignedUploadResponse> {
	const { data } = await api.post<PresignedUploadResponse>(
		"/auth/signup/profile-image/presigned-url",
		body,
	);
	return data;
}

/** POST /auth/token/refresh — Access Token 재발급 */
export async function refreshToken(
	body: RefreshRequest = {},
): Promise<RefreshResponse> {
	const { data } = await api.post<RefreshResponse>(
		"/auth/token/refresh",
		body,
	);
	return data;
}

/** POST /auth/logout — 로그아웃 */
export async function logout(body: LogoutRequest = {}): Promise<void> {
	await api.post("/auth/logout", body);
}

/** GET /auth/nicknames/suggestion — 무작위 미중복 닉네임 추천 */
export async function suggestNickname(): Promise<NicknameSuggestionResponse> {
	const { data } = await api.get<NicknameSuggestionResponse>(
		"/auth/nicknames/suggestion",
	);
	return data;
}

/** GET /auth/nicknames/availability — 닉네임 중복 확인 */
export async function checkNicknameAvailability(
	nickname: string,
): Promise<NicknameAvailabilityResponse> {
	const { data } = await api.get<NicknameAvailabilityResponse>(
		"/auth/nicknames/availability",
		{ params: { nickname } },
	);
	return data;
}

/** POST /test/auth/login — 테스트 로그인 (개발 환경 전용) */
export async function testLogin(
	body: TestLoginRequest,
): Promise<TestLoginResponse> {
	const { data } = await api.post<TestLoginResponse>(
		"/test/auth/login",
		body,
	);
	return data;
}
