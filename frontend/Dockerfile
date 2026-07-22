FROM node:20-alpine
WORKDIR /app
COPY package*.json ./

# --legacy-peer-deps 옵션 추가
RUN npm install --legacy-peer-deps

COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host"]