# 백엔드 테스트용 (Java 21)
FROM eclipse-temurin:21-jdk
WORKDIR /app
COPY . .
# 실행 권한 부여 및 빌드
RUN chmod +x gradlew
RUN ./gradlew bootJar
EXPOSE 8080
CMD ["sh", "-c", "java -jar build/libs/*.jar"]