import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // VITE_API_PROXY_TARGET을 설정하면 /api 요청을 그 서버로 대신 보낸다.
  // dev 서버는 https인데 배포 백엔드의 CORS 허용 origin은 http://localhost:5173이라
  // 브라우저가 직접 호출하면 차단된다. 프록시를 거치면 동일 출처 요청이 되어 CORS가 사라진다.
  const apiProxyTarget = env.VITE_API_PROXY_TARGET;

  return {
    plugins: [
      react(),
      tailwindcss(),
      // 폰 카메라(getUserMedia)는 보안 컨텍스트(HTTPS)에서만 동작 → dev 자체 서명 인증서
      basicSsl(),
    ],
    // 폰(같은 와이파이)에서 PC의 LAN IP로 접속할 수 있도록 0.0.0.0 바인딩
    server: {
      host: true,
      ...(apiProxyTarget && {
        proxy: {
          '/api': {
            target: apiProxyTarget,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            configure: (proxy) => {
              // 배포 백엔드의 CORS 허용 목록(CORS_ALLOWED_ORIGINS)에 로컬 오리진이 없어
              // 브라우저 Origin을 그대로 넘기면 403 "Invalid CORS request"가 된다.
              // 프록시는 서버 간 호출이라 Origin이 필요 없으므로 떼고 보낸다.
              proxy.on('proxyReq', (proxyReq) => {
                proxyReq.removeHeader('origin');
              });
            },
          },
        },
      }),
    },
  };
});
