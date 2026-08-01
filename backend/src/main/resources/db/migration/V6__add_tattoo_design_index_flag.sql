-- 커버업 검색 엔진에 색인이 반영됐는지 추적한다. 색인 누락 탐지·복구 스캔이 이 값을 본다.
ALTER TABLE tattoo_designs
    ADD COLUMN indexed BOOLEAN NOT NULL DEFAULT FALSE;

-- image_seq 단독 조회용 인덱스는 만들지 않는다.
-- uq_tattoo_designs_image UNIQUE (image_seq) 가 이미 같은 인덱스를 제공한다.

-- 미색인 스캔용 부분 인덱스. 색인 대상은 전체의 극히 일부라 부분 인덱스가 맞다.
CREATE INDEX idx_td_unindexed ON tattoo_designs (tattoo_seq)
    WHERE indexed = FALSE AND is_deleted = FALSE;
