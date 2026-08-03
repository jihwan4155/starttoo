/**
 * 구글 OAuth 인가 URL 빌더.
 *
 * 구글은 카카오처럼 별도 JS SDK 키가 없고, 클라이언트 ID를 그대로 인가 URL에 쓴다
 * (브라우저 노출이 정상인 공개 값). 동의 화면을 거치면 redirect URI로 authorization
 * code만 돌아오고, 코드를 토큰으로 바꾸는 일은 client secret이 필요해 서버가 맡는다.
 */

import { googleRedirectUri } from "../constants/auth";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";

/**
 * 인가 화면에 추가로 요구할 상호작용.
 *
 * 구글이 문서에 명시한 값은 이 셋뿐이다 — 카카오의 `login`(비밀번호 재입력)에
 * 대응하는 값이 없다. 그래서 로그아웃 뒤 재로그인에는 `select_account`를 써서
 * 최소한 계정 선택 화면을 반드시 거치게 한다(같은 계정으로 조용히 다시
 * 로그인되는 것을 막는다). 이미 구글에 로그인된 계정을 고르면 비밀번호는
 * 다시 묻지 않는다.
 */
export type GooglePrompt = "none" | "consent" | "select_account";

/** 동의 화면으로 보낼 인가 요청 URL을 만든다. state는 콜백에서 CSRF 대조용. */
export function buildGoogleAuthorizeUrl(
	state: string,
	prompt?: GooglePrompt,
): string {
	const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
	if (!clientId) {
		throw new Error(
			"VITE_GOOGLE_CLIENT_ID가 설정되지 않았습니다. .env.local에 구글 OAuth 클라이언트 ID를 넣어주세요.",
		);
	}
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: googleRedirectUri(),
		response_type: "code",
		// 백엔드가 openidconnect userinfo로 이메일·프로필을 읽으므로 세 스코프가 모두 필요하다.
		scope: "openid email profile",
		state,
	});
	if (prompt) {
		params.set("prompt", prompt);
	}
	return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
}
