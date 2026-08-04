package com.starttoo.backend.post.domain;

/**
 * 게시물 이미지의 타투 분류 진행 상태. 게시물·이미지의 노출과는 무관한 부가 정보이며,
 * 어떤 상태에서도 post_images 행은 삭제되지 않는다.
 */
public enum ClassificationStatus {

    /** 분류 대기. 비동기 워커가 처리하고, 놓치면 백필 스케줄러가 주워간다. */
    PENDING,

    /** 타투로 판별해 tattoos 행 생성까지 끝났다. 종료 상태. */
    DONE,

    /** 타투가 아니다. 게시물 이미지로는 정상 사용되며 tattooSeq 만 계속 null 이다. 종료 상태. */
    NOT_TATTOO,

    /** 처리 실패. 시도 횟수가 상한에 닿을 때까지 재시도 대상이다. */
    FAILED;

    public boolean terminal() {
        return this == DONE || this == NOT_TATTOO;
    }
}
