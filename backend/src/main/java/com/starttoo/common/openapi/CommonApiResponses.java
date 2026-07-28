package com.starttoo.common.openapi;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 공통 오류 응답 적용 대상을 표시하는 마커다.
 * 실제 오류 응답은 성공 응답 스키마 생성을 방해하지 않도록 OpenAPI 후처리에서 추가한다.
 */
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface CommonApiResponses {
}
