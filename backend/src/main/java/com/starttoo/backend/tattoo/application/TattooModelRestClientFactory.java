package com.starttoo.backend.tattoo.application;

import org.springframework.web.client.RestClient;

import java.time.Duration;

/**
 * read timeout 을 지정해 타투 모델 전용 {@link RestClient} 를 만든다.
 * {@code RestClient} 는 요청별 타임아웃 API 가 없어서, 배치 크기에 따라 타임아웃을
 * 바꾸려면 호출 시점에 클라이언트를 만들어야 한다. 이 경계를 인터페이스로 둬야
 * 테스트에서 {@code MockRestServiceServer} 에 묶은 클라이언트를 대신 넣을 수 있다.
 */
@FunctionalInterface
public interface TattooModelRestClientFactory {

    RestClient create(Duration readTimeout);
}
