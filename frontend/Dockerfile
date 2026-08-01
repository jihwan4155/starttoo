# 1단계: 빌드
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

# nginx가 /v1/을 backend로 프록시해주므로, 같은 origin의 상대경로로 호출하면
# 어떤 도메인으로 접속하든(로컬 IP, 도메인 등) 항상 올바른 backend를 찾는다.
ARG VITE_API_BASE_URL=/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# 카카오 JavaScript 앱 키. Vite의 import.meta.env는 빌드 시점에 번들로 치환되므로
# 런타임 환경변수로는 주입할 수 없고 반드시 build arg로 받아야 한다.
# 이 키는 브라우저에 노출되는 것이 정상이며, 카카오 콘솔에 등록된 도메인에서만 동작한다.
ARG VITE_KAKAO_JS_KEY
ENV VITE_KAKAO_JS_KEY=$VITE_KAKAO_JS_KEY

RUN npm run build

# 2단계: 정적 파일 서빙 (nginx)
FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:80/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]