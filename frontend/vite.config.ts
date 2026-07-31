import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import type { ClientRequest } from 'node:http';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // 폰 카메라(getUserMedia)는 보안 컨텍스트(HTTPS)에서만 동작 → dev 자체 서명 인증서
    basicSsl(),
  ],
  // 폰(같은 와이파이)에서 PC의 LAN IP로 접속할 수 있도록 0.0.0.0 바인딩
  server: {
    host: true,
    // dev는 HTTPS(basicSsl) → API를 같은 origin(/v1)으로 두고 로컬 BE로 프록시 (mixed content 방지)
    proxy: {
      '/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // 브라우저 Origin(https://localhost:5173)이 BE CORS(http://5173)와 달라 403 나는 것 방지
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq: ClientRequest) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
        },
      },
    },
  },
});