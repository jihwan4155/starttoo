package com.starttoo.backend.common.config;

import io.minio.MinioClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MinioConfig {

    @Bean
    MinioClient minioClient(MinioProperties properties) {
        return MinioClient.builder()
                .endpoint(properties.endpoint())
                .credentials(properties.accessKey(), properties.secretKey())
                .build();
    }

    // presigned URL 서명에만 쓰는 클라이언트. 실제로 이 endpoint로 네트워크 요청을 보내지
    // 않고 서명 문자열만 로컬에서 계산하므로, 외부에서 접근 가능한 public endpoint를 넣어도 안전하다.
    @Bean
    MinioClient minioPresignClient(MinioProperties properties) {
        return MinioClient.builder()
                .endpoint(properties.publicEndpoint())
                .credentials(properties.accessKey(), properties.secretKey())
                .build();
    }
}
