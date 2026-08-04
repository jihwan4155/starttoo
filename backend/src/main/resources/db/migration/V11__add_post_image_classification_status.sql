-- 게시물 이미지의 타투 분류 진행 상태. 게시물 저장과 같은 트랜잭션에서 PENDING 을
-- 남겨 두면, 비동기 워커가 죽거나 서버가 재시작돼도 백필 스케줄러가 주워갈 수 있다.
-- 이 컬럼은 부가 정보일 뿐이며 post_images 행 자체는 어떤 상태에서도 삭제하지 않는다.
--   PENDING     분류 대기 (비동기 워커 또는 백필 대상)
--   DONE        타투로 판별해 tattoos 행 생성 완료 (종료)
--   NOT_TATTOO  타투가 아님. 게시물 이미지로는 정상 사용된다 (종료)
--   FAILED      처리 실패. 시도 횟수가 상한에 닿을 때까지 재시도한다

ALTER TABLE post_images
    ADD COLUMN classification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN classification_attempt_count SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN classification_mod_dttm TIMESTAMPTZ;

ALTER TABLE post_images
    ADD CONSTRAINT ck_post_images_classification_status
        CHECK (classification_status IN ('PENDING', 'DONE', 'NOT_TATTOO', 'FAILED'));

-- 기존 행은 모두 종료 상태로 확정한다. 이걸 빼면 마이그레이션 직후 백필 스케줄러가
-- 과거 게시물 전체를 재분류하려 들면서 AI 서버를 점유한다.
UPDATE post_images pi
   SET classification_status = CASE
           WHEN EXISTS (
               SELECT 1
                 FROM tattoos t
                WHERE t.image_seq = pi.image_seq
                  AND t.is_deleted = FALSE
           ) THEN 'DONE'
           ELSE 'NOT_TATTOO'
       END,
       classification_mod_dttm = CURRENT_TIMESTAMP;

-- 백필은 미처리 행만 훑는다. 대부분의 행이 종료 상태이므로 부분 인덱스로 좁힌다.
CREATE INDEX ix_post_images_classification_pending
    ON post_images (classification_status, classification_mod_dttm)
 WHERE classification_status IN ('PENDING', 'FAILED');
