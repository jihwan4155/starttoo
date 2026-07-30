-- 모델 연동과 초기 API 검증에 필요한 최소 분류 기준정보.
-- 운영 모델의 분류 코드가 확정되면 새 마이그레이션 또는 관리자 API로 확장한다.
INSERT INTO primary_styles (
    style_code, style_name, is_active, reg_usr_seq, mod_usr_seq
) VALUES ('OTHER', '기타', TRUE, 1, 1);

INSERT INTO secondary_styles (
    style_code, style_name, is_active, reg_usr_seq, mod_usr_seq
) VALUES ('OTHER', '기타', TRUE, 1, 1);

INSERT INTO rendering_styles (
    style_code, style_name, is_active, reg_usr_seq, mod_usr_seq
) VALUES ('LINE', '라인', TRUE, 1, 1);

INSERT INTO colors (
    color_code, color_name, is_active, reg_usr_seq, mod_usr_seq
) VALUES ('BLACK', '블랙', TRUE, 1, 1);
