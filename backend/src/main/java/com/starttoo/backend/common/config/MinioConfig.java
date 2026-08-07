package com.starttoo.backend.common.config;

import io.minio.MinioClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MinioConfig {

    /**
     * MinIO SDK는 region이 비어 있으면 Presigned URL 발급 전 서버에 region을 묻는다.
     * public endpoint가 브라우저용(localhost 등)이라 컨테이너에서 닿지 않으면
     * archive/collection 목록 전체가 503이 된다. 로컬 서명만 쓰므로 region을 고정한다.
     */
    private static final String SIGNING_REGION = "us-east-1";

    @Bean
    MinioClient minioClient(MinioProperties properties) {
        return MinioClient.builder()
                .endpoint(properties.endpoint())
                .credentials(properties.accessKey(), properties.secretKey())
                .region(SIGNING_REGION)
                .build();
    }

    // presigned URL 서명에만 쓰는 클라이언트. region을 고정하면 네트워크 왕복 없이
    // 서명 문자열만 로컬에서 계산하므로, 브라우저용 public endpoint를 넣어도 안전하다.
    @Bean
    MinioClient minioPresignClient(MinioProperties properties) {
        return MinioClient.builder()
                .endpoint(properties.publicEndpoint())
                .credentials(properties.accessKey(), properties.secretKey())
                .region(SIGNING_REGION)
                .build();
    }
}
