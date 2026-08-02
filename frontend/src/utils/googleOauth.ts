/**
 * 구글 OAuth 인가 URL 빌더.
 *
 * 구글은 카카오처럼 별도 JS SDK 키가 없고, 클라이언트 ID를 그대로 인가 URL에 쓴다
 * (브라우저 노출이 정상인 공개 값). 동의 화면을 거치면 redirect URI로 authorization
 * code만 돌아오고, 코드를 토큰으로 바꾸는 일은 client secret이 필요해 서버가 맡는다.
 */

import { googleRedirectUri } from "../constants/auth";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";

/** 동의 화면으로 보낼 인가 요청 URL을 만든다. state는 콜백에서 CSRF 대조용. */
export function buildGoogleAuthorizeUrl(state: string): string {
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
	return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
}
