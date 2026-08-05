package com.starttoo.backend.search.application;

import org.springframework.stereotype.Component;

@Component
public class KoreanJamoNormalizer {

    private static final char[] INITIALS = {
            'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
            'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
    };
    private static final char[] MEDIALS = {
            'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
            'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
    };
    private static final char[] FINALS = {
            '\0', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
            'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
            'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
    };

    public String normalize(String value) {
        StringBuilder result = new StringBuilder();
        for (int index = 0; index < value.length(); index++) {
            char current = value.charAt(index);
            if (current >= 0xAC00 && current <= 0xD7A3) {
                int syllable = current - 0xAC00;
                result.append(INITIALS[syllable / (21 * 28)]);
                result.append(MEDIALS[(syllable % (21 * 28)) / 28]);
                char finalJamo = FINALS[syllable % 28];
                if (finalJamo != '\0') {
                    result.append(finalJamo);
                }
            } else {
                // 색인·질의 양쪽에서 같은 정규화를 쓰므로 영문 대소문자 차이로
                // exact/prefix/contains 단계가 미스나지 않도록 소문자로 통일한다.
                result.append(Character.toLowerCase(current));
            }
        }
        return result.toString();
    }
}
