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
 * 사용자가 직접 로그아웃했다는 표시 — 다음 로그인까지 남는다.
 *
 * 우리 로그아웃은 서비스 토큰만 폐기하고 브라우저에 남은 카카오·구글 계정 세션에는
 * 손대지 않는다. 그래서 로그아웃 직후 다시 로그인 버튼을 누르면 같은 계정으로 조용히
 * 통과된다. 이 표시가 있으면 인가 요청에 프롬프트를 붙인다.
 *
 * · 카카오 — `prompt=login`. 계정 세션이 남아 있어도 아이디·비밀번호를 다시 받는다.
 * · 구글  — `prompt=select_account`. 구글은 `login`에 해당하는 값이 없어 비밀번호
 *           재입력은 강제할 수 없고, 계정 선택 화면까지만 보장된다.
 *
 * 탭을 닫았다 열어도 유지돼야 하므로(공용 PC에서 다음 사람이 이전 계정으로 자동
 * 로그인되는 것을 막는다) sessionStorage가 아니라 localStorage에 둔다.
 */
export const REAUTH_REQUIRED_STORAGE_KEY = "starttoo-reauth-required";

/**
 * 번호 확인용 고정 코드.
 *
 * SMS 발송 비용 때문에 실제 인증은 하지 않기로 했다. 서버로 보내지 않고
 * 사용자가 입력한 번호를 한 번 더 확인하게 만드는 화면 전용 장치다.
 */
export const PHONE_CONFIRM_CODE = "1111";

/**
 * 인증 플로우 자체의 화면인지 — 로그인 뒤 돌아갈 곳으로 삼으면 안 되는 경로들이다.
 *
 * 소셜 가입을 중간에 그만두면 /signup에 남게 되는데, 거기서 상단바 로그인 모달로
 * 다른 제공자에 로그인하면 목적지가 /signup으로 잡힌다. 로그인은 성공했는데 가입
 * 화면으로 돌아가고, 세션이 생겼으니 /signup 가드가 다시 온보딩으로 밀어 버린다.
 * 기존 회원에게 회원가입을 다시 시키는 것처럼 보이는 원인이라, 이런 경로에서
 * 시작한 로그인은 목적지를 버리고 홈으로 보낸다.
 */
export function isAuthFlowPath(pathname: string): boolean {
	return [
		"/login",
		"/signup",
		"/onboarding",
		KAKAO_CALLBACK_PATH,
		GOOGLE_CALLBACK_PATH,
	].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * 보관해 둔 로그인 후 목적지를 쓸 수 있는 값으로 걸러 낸다. 쓸 수 없으면 null.
 *
 * 우리가 저장한 값이지만, 다른 오리진으로 튕겨 보내는 값이 섞이지 않도록
 * 같은 오리진의 절대 경로만 통과시킨다(`//host` 형태는 프로토콜 상대 URL이다).
 */
export function safePostLoginRedirect(stored: string | null): string | null {
	if (!stored || !stored.startsWith("/") || stored.startsWith("//")) {
		return null;
	}
	const { pathname } = new URL(stored, window.location.origin);
	return isAuthFlowPath(pathname) ? null : stored;
}

/** 현재 오리진 기준 절대 redirect URI — 인가와 토큰 교환에서 동일한 값이어야 한다 */
export function kakaoRedirectUri(): string {
	return `${window.location.origin}${KAKAO_CALLBACK_PATH}`;
}

/** 현재 오리진 기준 절대 redirect URI — 인가와 토큰 교환에서 동일한 값이어야 한다 */
export function googleRedirectUri(): string {
	return `${window.location.origin}${GOOGLE_CALLBACK_PATH}`;
}
