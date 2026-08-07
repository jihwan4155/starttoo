ALTER TABLE tattoos
    DROP CONSTRAINT IF EXISTS ck_tattoos_source_type;

ALTER TABLE tattoos
    ADD CONSTRAINT ck_tattoos_source_type
        CHECK (source_type IN (
            'DEFAULT',
            'USER_POST',
            'USER_COLLECTION',
            'USER_EXTRACTION'
        ));
