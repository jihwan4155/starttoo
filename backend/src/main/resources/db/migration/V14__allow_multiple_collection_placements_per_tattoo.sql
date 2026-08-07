-- 같은 도안(tattoo)을 마네킹에 여러 번 배치할 수 있도록
-- tattoo_collections.tattoo_seq 1:1 UNIQUE를 제거한다.
ALTER TABLE tattoo_collections
    DROP CONSTRAINT IF EXISTS uq_tattoo_collections_tattoo;

CREATE INDEX IF NOT EXISTS idx_tattoo_collections_tattoo_active
    ON tattoo_collections (tattoo_seq)
    WHERE is_deleted = FALSE;
