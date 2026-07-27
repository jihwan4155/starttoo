/** 백엔드 Auth 도메인 타입 (Swagger: Starttoo API - Auth) */

export type UserRole = "USER" | "ARTIST";
export type SocialProvider = "GOOGLE" | "KAKAO";
export type Platform = "WEB" | "ANDROID" | "IOS";
export type SignupGender = "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";
export type ProfileImageContentType = "image/jpeg" | "image/png" | "image/webp";

/** UserSummary.artist */
export type ArtistSummary = {
	approvalStatus: string;
};

/** 로그인·회원가입 응답에 포함되는 회원 요약 */
export type UserSummary = {
	userId: number;
	nickname: string;
	role: UserRole | string;
	accountStatus: string;
	profileImageUrl?: string | null;
	artist?: ArtistSummary | null;
};

/** POST /auth/social/login 요청 */
export type SocialLoginRequest = {
	authorizationCode: string;
	provider: SocialProvider;
	platform: Platform;
	redirectUri: string;
	pushToken?: string;
};

export type SocialProfileResponse = {
	email?: string;
	provider?: string;
};

/** POST /auth/social/login 응답 */
export type SocialLoginResponse = {
	/** 신규 회원이면 true → signupToken으로 회원가입 진행 */
	registrationRequired: boolean;
	signupToken?: string | null;
	socialProfile?: SocialProfileResponse | null;
	accessToken?: string | null;
	refreshToken?: string | null;
	tokenType?: string | null;
	expiresIn?: number | null;
	user?: UserSummary | null;
};

/** ARTIST 가입 시 추가 프로필 */
export type ArtistProfileRequest = {
	shopName?: string;
	shopCity?: string;
	shopAddress?: string;
	shopPhone?: string;
	businessHours?: string;
};

/** POST /auth/signup 요청 */
export type SignupRequest = {
	signupToken: string;
	nickname: string;
	role: UserRole;
	birthDate?: string;
	gender?: SignupGender;
	profileImageKey?: string;
	artistProfile?: ArtistProfileRequest;
};

/** 로그인·회원가입 토큰 응답 */
export type TokenResponse = {
	accessToken: string;
	refreshToken?: string;
	tokenType: string;
	expiresIn: number;
	user?: UserSummary;
};

/** POST /auth/token/refresh 요청 (쿠키 refreshToken 대체용 바디) */
export type RefreshRequest = {
	refreshToken?: string;
};

/** POST /auth/token/refresh 응답 */
export type RefreshResponse = {
	accessToken: string;
	refreshToken?: string;
	tokenType: string;
	expiresIn: number;
};

/** POST /auth/logout 요청 */
export type LogoutRequest = {
	refreshToken?: string;
};

/** GET /auth/nicknames/suggestion 응답 */
export type NicknameSuggestionResponse = {
	nickname: string;
};

/** GET /auth/nicknames/availability 응답 */
export type NicknameAvailabilityResponse = {
	nickname: string;
	available: boolean;
};

/** POST /auth/signup/profile-image/presigned-url 요청 */
export type SignupProfileUploadRequest = {
	signupToken: string;
	contentType: ProfileImageContentType;
	fileSize?: number;
};

/** POST /test/auth/login 요청 (개발용) */
export type TestLoginRequest = {
	userId: number;
};

export type TestUser = {
	userId: number;
	nickname: string;
	role: string;
	accountStatus: string;
};

/** POST /test/auth/login 응답 (refreshToken 미포함) */
export type TestLoginResponse = {
	accessToken: string;
	tokenType: string;
	expiresIn: number;
	user: TestUser;
};
