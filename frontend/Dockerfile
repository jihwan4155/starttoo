# 프론트엔드 테스트용 (Node.js 기반)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install || true
COPY . .
EXPOSE 3000
# 테스트용 웹 서버 구동 (스켈레톤 실행 명령)
CMD ["npm", "run", "dev", "--", "--host"]