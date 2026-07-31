/**
 * 카카오 콘솔의 [카카오 로그인 > Redirect URI]에 등록된 경로와 **정확히** 같아야 한다.
 * 등록값: https://localhost:5173/oauth/kakao/callback
 *        https://starttoo.duckdns.org/oauth/kakao/callback
 */
export const KAKAO_CALLBACK_PATH = "/oauth/kakao/callback";

/** 인가 요청과 콜백 사이에서 CSRF를 막기 위한 state 보관 키 */
export const OAUTH_STATE_STORAGE_KEY = "starttoo-oauth-state";

/** 현재 오리진 기준 절대 redirect URI — 인가와 토큰 교환에서 동일한 값이어야 한다 */
export function kakaoRedirectUri(): string {
	return `${window.location.origin}${KAKAO_CALLBACK_PATH}`;
}
