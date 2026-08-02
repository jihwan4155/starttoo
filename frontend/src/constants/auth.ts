/**
 * 카카오 콘솔의 [카카오 로그인 > Redirect URI]에 등록된 경로와 **정확히** 같아야 한다.
 * 등록값: https://localhost:5173/oauth/kakao/callback
 *        https://starttoo.duckdns.org/oauth/kakao/callback
 */
export const KAKAO_CALLBACK_PATH = "/oauth/kakao/callback";

/**
 * 구글 클라우드 콘솔의 [OAuth 클라이언트 > 승인된 리디렉션 URI]에 등록된 경로와
 * **정확히** 같아야 한다.
 * 등록값: https://localhost:5173/oauth/google/callback
 *        https://starttoo.duckdns.org/oauth/google/callback
 */
export const GOOGLE_CALLBACK_PATH = "/oauth/google/callback";

/** 인가 요청과 콜백 사이에서 CSRF를 막기 위한 state 보관 키 */
export const OAUTH_STATE_STORAGE_KEY = "starttoo-oauth-state";

/**
 * 로그인 필요 페이지에서 로그인 화면으로 튕겨낼 때 원래 목적지를 보관하는 키.
 * OAuth 로그인은 페이지를 완전히 떠났다 돌아오므로 라우터 state로는 전달할 수 없다.
 */
export const POST_LOGIN_REDIRECT_STORAGE_KEY = "starttoo-post-login-redirect";

/**
 * 번호 확인용 고정 코드.
 *
 * SMS 발송 비용 때문에 실제 인증은 하지 않기로 했다. 서버로 보내지 않고
 * 사용자가 입력한 번호를 한 번 더 확인하게 만드는 화면 전용 장치다.
 */
export const PHONE_CONFIRM_CODE = "1111";

/** 현재 오리진 기준 절대 redirect URI — 인가와 토큰 교환에서 동일한 값이어야 한다 */
export function kakaoRedirectUri(): string {
	return `${window.location.origin}${KAKAO_CALLBACK_PATH}`;
}

/** 현재 오리진 기준 절대 redirect URI — 인가와 토큰 교환에서 동일한 값이어야 한다 */
export function googleRedirectUri(): string {
	return `${window.location.origin}${GOOGLE_CALLBACK_PATH}`;
}
