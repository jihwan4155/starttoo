/**
 * 백엔드 Auth 도메인 타입
 * 기준: https://starttoo.duckdns.org/v3/api-docs (2026-07-31 확인)
 */

/** 프로필 조회 등에서 내려오는 계정 역할 */
export type UserRole = "USER" | "ARTIST" | "ADMIN";
/** 가입 시 요청 가능한 역할 (ADMIN 가입은 서버가 거부) */
export type RequestedRole = "USER" | "ARTIST";
export type SocialProvider = "GOOGLE" | "KAKAO";
export type SignupGender = "M" | "F";

/** 로그인·가입·재발급 공통 토큰 응답 */
export type TokenResponse = {
	accessToken: string;
	/** ISO 8601 만료 시각 */
	accessTokenExpiresAt: string;
	refreshToken: string;
	refreshTokenExpiresAt: string;
	tokenType: string;
};

/**
 * POST /auth/social/login 요청
 *
 * accessToken(네이티브 앱)과 authorizationCode(웹) 중 **하나만** 보낸다.
 * 카카오 JS SDK는 브라우저에 액세스 토큰을 주지 않고 authorization code까지만 주며,
 * 코드→토큰 교환에는 서버 전용 키가 필요하므로 웹은 항상 code 방식을 쓴다.
 */
export type SocialLoginRequest = {
	provider: SocialProvider;
	/** 네이티브 앱 SDK가 받은 제공자 액세스 토큰 */
	accessToken?: string;
	/** 웹에서 동의 화면 후 받은 authorization code */
	authorizationCode?: string;
	/** code 방식에서 필수. 인가 때 쓴 값과 정확히 같아야 한다 */
	redirectUri?: string;
};

/** POST /auth/social/login 응답 */
export type SocialLoginResponse = {
	/** true면 이 소셜 계정이 아직 어디에도 연결되지 않은 상태 → 가입 진행 */
	signupRequired: boolean;
	/** signupRequired=true일 때 내려오며 POST /auth/signup에 그대로 전달 */
	signupToken?: string;
	/** signupRequired=false일 때만 내려온다 */
	tokens?: TokenResponse;
};

/** POST /auth/signup 요청 */
export type SignupRequest = {
	signupToken: string;
	/** 하이픈·공백은 서버가 제거하고 +82 E.164로 정규화한다 */
	phoneNumber: string;
	/** ^[가-힣A-Za-z0-9]{2,20}$ — 공백·특수문자 불가 */
	nickname: string;
	/**
	 * ARTIST로 가입해도 users.role은 USER이고 artists 확장 행이 UNVERIFIED로 생긴다.
	 * 가입 후 PATCH /artists/me/profile 로도 같은 상태를 만들 수 있어,
	 * 온보딩에서 역할을 고르게 하려면 여기서는 USER로 보내면 된다.
	 */
	requestedRole: RequestedRole;
	/** YYYY-MM-DD */
	birthDate?: string;
	gender?: SignupGender;
};

/** POST /auth/token/refresh 요청 */
export type RefreshRequest = {
	refreshToken: string;
};

/** POST /auth/logout 요청 */
export type LogoutRequest = {
	refreshToken: string;
};

/** GET /auth/phones/availability 응답 */
export type PhoneAvailabilityResponse = {
	normalizedPhoneNumber: string;
	/**
	 * 가입 가능 여부. false에는 "이미 가입된 번호"와
	 * "정지·강퇴 회원의 예약 번호"가 함께 들어간다 (응답으로 구분 불가).
	 */
	available: boolean;
	/** 이미 가입된 번호면 그 계정의 제공자, 미가입이면 null */
	provider?: SocialProvider | null;
};

/** GET /auth/nicknames/suggestions 응답 */
export type NicknameSuggestionsResponse = {
	items: string[];
};

/** GET /auth/nicknames/availability 응답 */
export type NicknameAvailabilityResponse = {
	nickname: string;
	available: boolean;
};

/**
 * 세션에 보관하는 사용자 요약.
 * 현재 auth 응답에는 사용자 정보가 포함되지 않으므로 GET /users/me로 채운다.
 */
export type UserSummary = {
	userId: number;
	nickname: string;
	role: UserRole | string;
	accountStatus: string;
	profileImageUrl?: string | null;
};
