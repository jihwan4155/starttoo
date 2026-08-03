-- AI classifier labels returned by ai_server /tattoos/analyze.
-- Keep the legacy stub rows from V3; add the production model label ids as active codes.

INSERT INTO primary_styles (style_code, style_name, is_active, reg_usr_seq, mod_usr_seq)
VALUES
    ('western_traditional', 'Western Traditional', TRUE, 1, 1),
    ('japanese', 'Japanese', TRUE, 1, 1),
    ('realism', 'Realism', TRUE, 1, 1),
    ('new_school', 'New School', TRUE, 1, 1),
    ('minimal', 'Minimal', TRUE, 1, 1),
    ('abstract_experimental', 'Abstract Experimental', TRUE, 1, 1),
    ('geometric', 'Geometric', TRUE, 1, 1),
    ('ornamental', 'Ornamental', TRUE, 1, 1),
    ('tribal_indigenous', 'Tribal Indigenous', TRUE, 1, 1),
    ('lettering', 'Lettering', TRUE, 1, 1),
    ('graphic_illustrative', 'Graphic Illustrative', TRUE, 1, 1)
ON CONFLICT (style_code) DO UPDATE
SET style_name = EXCLUDED.style_name,
    is_active = TRUE,
    mod_dttm = CURRENT_TIMESTAMP,
    mod_usr_seq = EXCLUDED.mod_usr_seq;

INSERT INTO secondary_styles (style_code, style_name, is_active, reg_usr_seq, mod_usr_seq)
VALUES
    ('american_traditional', 'American Traditional', TRUE, 1, 1),
    ('neo_traditional', 'Neo Traditional', TRUE, 1, 1),
    ('traditional_irezumi', 'Traditional Irezumi', TRUE, 1, 1),
    ('neo_japanese', 'Neo Japanese', TRUE, 1, 1),
    ('photorealism', 'Photorealism', TRUE, 1, 1),
    ('illustrative_realism', 'Illustrative Realism', TRUE, 1, 1),
    ('micro_realism', 'Micro Realism', TRUE, 1, 1),
    ('surreal_realism', 'Surreal Realism', TRUE, 1, 1),
    ('chicano_realism', 'Chicano Realism', TRUE, 1, 1),
    ('classic_new_school', 'Classic New School', TRUE, 1, 1),
    ('cartoon_pop', 'Cartoon Pop', TRUE, 1, 1),
    ('anime_manga', 'Anime Manga', TRUE, 1, 1),
    ('kawaii', 'Kawaii', TRUE, 1, 1),
    ('gestural_abstract', 'Gestural Abstract', TRUE, 1, 1),
    ('fluid_organic', 'Fluid Organic', TRUE, 1, 1),
    ('abstract_geometry', 'Abstract Geometry', TRUE, 1, 1),
    ('cyber_sigil', 'Cyber Sigil', TRUE, 1, 1),
    ('surrealism', 'Surrealism', TRUE, 1, 1),
    ('figurative_geometric', 'Figurative Geometric', TRUE, 1, 1),
    ('polygonal', 'Polygonal', TRUE, 1, 1),
    ('optical', 'Optical', TRUE, 1, 1),
    ('geometric_pattern', 'Geometric Pattern', TRUE, 1, 1),
    ('geometric_abstraction', 'Geometric Abstraction', TRUE, 1, 1),
    ('mandala', 'Mandala', TRUE, 1, 1),
    ('floral_ornamental', 'Floral Ornamental', TRUE, 1, 1),
    ('filigree_ornamental', 'Filigree Ornamental', TRUE, 1, 1),
    ('ornamental_pattern', 'Ornamental Pattern', TRUE, 1, 1),
    ('polynesian', 'Polynesian', TRUE, 1, 1),
    ('celtic', 'Celtic', TRUE, 1, 1),
    ('neo_tribal', 'Neo Tribal', TRUE, 1, 1),
    ('script', 'Script', TRUE, 1, 1),
    ('blackletter', 'Blackletter', TRUE, 1, 1),
    ('typewriter', 'Typewriter', TRUE, 1, 1),
    ('naturalist_illustration', 'Naturalist Illustration', TRUE, 1, 1),
    ('editorial_illustration', 'Editorial Illustration', TRUE, 1, 1),
    ('folk_naive', 'Folk Naive', TRUE, 1, 1),
    ('dark_art', 'Dark Art', TRUE, 1, 1)
ON CONFLICT (style_code) DO UPDATE
SET style_name = EXCLUDED.style_name,
    is_active = TRUE,
    mod_dttm = CURRENT_TIMESTAMP,
    mod_usr_seq = EXCLUDED.mod_usr_seq;

INSERT INTO rendering_styles (style_code, style_name, is_active, reg_usr_seq, mod_usr_seq)
VALUES
    ('linework', 'Linework', TRUE, 1, 1),
    ('fine_line', 'Fine Line', TRUE, 1, 1),
    ('sketch', 'Sketch', TRUE, 1, 1),
    ('engraving_etching', 'Engraving Etching', TRUE, 1, 1),
    ('dotwork', 'Dotwork', TRUE, 1, 1),
    ('blackwork', 'Blackwork', TRUE, 1, 1),
    ('watercolor', 'Watercolor', TRUE, 1, 1)
ON CONFLICT (style_code) DO UPDATE
SET style_name = EXCLUDED.style_name,
    is_active = TRUE,
    mod_dttm = CURRENT_TIMESTAMP,
    mod_usr_seq = EXCLUDED.mod_usr_seq;

INSERT INTO colors (color_code, color_name, is_active, reg_usr_seq, mod_usr_seq)
VALUES
    ('black_only', 'Black Only', TRUE, 1, 1),
    ('black_and_gray', 'Black and Gray', TRUE, 1, 1),
    ('black_with_color_accent', 'Black with Color Accent', TRUE, 1, 1),
    ('limited_color', 'Limited Color', TRUE, 1, 1),
    ('full_color', 'Full Color', TRUE, 1, 1)
ON CONFLICT (color_code) DO UPDATE
SET color_name = EXCLUDED.color_name,
    is_active = TRUE,
    mod_dttm = CURRENT_TIMESTAMP,
    mod_usr_seq = EXCLUDED.mod_usr_seq;
