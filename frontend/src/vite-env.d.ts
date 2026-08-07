/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** 백엔드 API base URL. 미설정 시 http://localhost:8080/v1 */
	readonly VITE_API_BASE_URL?: string;
	/** 설정 시 vite dev 서버가 /api 요청을 이 주소로 프록시한다 */
	readonly VITE_API_PROXY_TARGET?: string;
	/** 카카오 개발자 콘솔의 JavaScript 앱 키 (REST API 키 아님) */
	readonly VITE_KAKAO_JS_KEY?: string;
	/** 구글 클라우드 콘솔의 OAuth 2.0 클라이언트 ID (secret 아님 — 브라우저 노출 정상) */
	readonly VITE_GOOGLE_CLIENT_ID?: string;
	/** 도안 추출 AI 서버 base URL. 미설정 시 /ai-service/api/v1 */
	readonly VITE_EXTRACT_API_BASE_URL?: string;
	/** 설정 시 vite dev 서버가 /ai-service 요청을 이 주소로 프록시한다 */
	readonly VITE_AI_PROXY_TARGET?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
