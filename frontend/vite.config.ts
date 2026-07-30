import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

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
  },
});