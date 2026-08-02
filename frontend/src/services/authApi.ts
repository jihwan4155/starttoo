import { api } from "./api";
import type {
	LogoutRequest,
	NicknameAvailabilityResponse,
	NicknameSuggestionsResponse,
	PhoneAvailabilityResponse,
	RefreshRequest,
	SignupRequest,
	SocialLoginRequest,
	SocialLoginResponse,
	TokenResponse,
} from "../types/auth";

/** POST /auth/social/login — 카카오·구글 소셜 로그인 (제공자 액세스 토큰 전달) */
export async function socialLogin(
	body: SocialLoginRequest,
): Promise<SocialLoginResponse> {
	const { data } = await api.post<SocialLoginResponse>(
		"/auth/social/login",
		body,
	);
	return data;
}

/** POST /auth/signup — 단일 OAuth 통합 계정 가입 */
export async function signup(body: SignupRequest): Promise<TokenResponse> {
	const { data } = await api.post<TokenResponse>("/auth/signup", body);
	return data;
}

/** POST /auth/token/refresh — Access Token 재발급 */
export async function refreshToken(
	body: RefreshRequest,
): Promise<TokenResponse> {
	const { data } = await api.post<TokenResponse>("/auth/token/refresh", body);
	return data;
}

/** POST /auth/logout — 로그아웃 */
export async function logout(body: LogoutRequest): Promise<void> {
	await api.post("/auth/logout", body);
}

/** GET /auth/phones/availability — 휴대폰 번호 사용 가능 여부·기존 가입 제공자 */
export async function checkPhoneAvailability(
	phoneNumber: string,
): Promise<PhoneAvailabilityResponse> {
	const { data } = await api.get<PhoneAvailabilityResponse>(
		"/auth/phones/availability",
		{ params: { phoneNumber } },
	);
	return data;
}

/** GET /auth/nicknames/suggestions — 무작위 미중복 닉네임 추천 */
export async function suggestNicknames(
	count?: number,
): Promise<NicknameSuggestionsResponse> {
	const { data } = await api.get<NicknameSuggestionsResponse>(
		"/auth/nicknames/suggestions",
		count == null ? undefined : { params: { count } },
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
