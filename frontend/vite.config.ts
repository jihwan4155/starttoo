import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import type { ClientRequest } from 'node:http';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // 프록시가 향할 백엔드. 기본은 로컬이고, VITE_API_PROXY_TARGET으로 배포 서버를
  // 가리킬 수 있다. 배포 백엔드의 CORS 허용 목록(CORS_ALLOWED_ORIGINS)에는 https
  // dev 서버가 없어서 브라우저 직접 호출은 403이 되므로, 배포 서버를 볼 때도
  // 반드시 이 프록시를 거쳐야 한다.
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080';
  // 자체 서명 인증서를 신뢰하지 못하는 환경(인앱 미리보기 브라우저 등)을 위한 HTTP 모드.
  // `npm run dev:http`(--mode http)로 켠다. 카메라(getUserMedia)·카카오 SDK는
  // 보안 컨텍스트가 필요하므로 평소 dev는 HTTPS 유지.
  const devHttps = mode !== 'http';

  return {
    plugins: [
      react(),
      tailwindcss(),
      // 폰 카메라(getUserMedia)는 보안 컨텍스트(HTTPS)에서만 동작 → dev 자체 서명 인증서
      ...(devHttps ? [basicSsl()] : []),
    ],
    // 폰(같은 와이파이)에서 PC의 LAN IP로 접속할 수 있도록 0.0.0.0 바인딩
    server: {
      host: true,
      // dev는 HTTPS(basicSsl) → API를 같은 origin(/v1)으로 두고 프록시 (mixed content 방지)
      proxy: {
        '/v1': {
          target: apiProxyTarget,
          changeOrigin: true,
          // 브라우저 Origin(https://localhost:5173)이 BE CORS(http://5173)와 달라 403 나는 것 방지
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq: ClientRequest) => {
              proxyReq.removeHeader('origin');
              proxyReq.removeHeader('referer');
            });
          },
        },
        // 도안 추출 AI 서버. 배포에서는 nginx가 /ai-service/ prefix를 벗겨
        // ai:8000으로 넘긴다. dev도 같은 경로를 쓰도록 여기서 프록시한다.
        // (로컬에서 AI 서버를 직접 띄웠다면 VITE_AI_PROXY_TARGET으로 가리킨다)
        '/ai-service': {
          target: env.VITE_AI_PROXY_TARGET || apiProxyTarget,
          changeOrigin: true,
          // 로컬 AI 서버를 직접 가리키는 경우 prefix를 여기서 벗겨야 한다.
          // 배포 서버(nginx)로 보낼 때는 nginx가 벗기므로 그대로 둔다.
          ...(env.VITE_AI_PROXY_TARGET
            ? { rewrite: (path: string) => path.replace(/^\/ai-service/, '') }
            : {}),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq: ClientRequest) => {
              proxyReq.removeHeader('origin');
              proxyReq.removeHeader('referer');
            });
          },
        },
        // STOMP over WebSocket (DM·알림 실시간 수신). dev가 https면 브라우저는
        // wss로 붙고 여기서 평문 ws로 백엔드에 넘긴다. ws:true 없으면 업그레이드가
        // 프록시되지 않아 연결이 즉시 끊긴다.
        '/ws': {
          target: apiProxyTarget,
          changeOrigin: true,
          ws: true,
          // /v1과 같은 이유 — 핸드셰이크 Origin이 BE 허용 목록(5173 http)과 달라
          // setAllowedOriginPatterns에서 거부되고 소켓이 1006으로 끊긴다.
          configure: (proxy) => {
            proxy.on('proxyReqWs', (proxyReq: ClientRequest) => {
              proxyReq.removeHeader('origin');
              proxyReq.removeHeader('referer');
            });
          },
        },
      },
    },
  };
});
