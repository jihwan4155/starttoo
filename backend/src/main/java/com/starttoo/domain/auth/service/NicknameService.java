package com.starttoo.domain.auth.service;

import com.starttoo.common.api.FieldErrorDetail;
import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.common.exception.FieldBusinessException;
import com.starttoo.domain.auth.dto.NicknameAvailabilityResponse;
import com.starttoo.domain.auth.dto.NicknameSuggestionResponse;
import com.starttoo.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NicknameService {

    private static final int MAX_ATTEMPTS = 50;
    private static final List<String> ADJECTIVES = List.of(
            "고요한", "빛나는", "푸른", "따뜻한", "자유로운", "선명한", "신비한", "작은"
    );
    private static final List<String> NOUNS = List.of(
            "달고래", "별여우", "구름새", "밤바다", "은하수", "민들레", "새벽달", "유성"
    );

    private final UserRepository userRepository;
    private final SecureRandom random = new SecureRandom();

    public NicknameAvailabilityResponse checkAvailability(String rawNickname) {
        String nickname = normalizeAndValidate(rawNickname);
        return new NicknameAvailabilityResponse(
                nickname,
                !userRepository.existsByNickname(nickname)
        );
    }

    public NicknameSuggestionResponse suggest() {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            String nickname = ADJECTIVES.get(random.nextInt(ADJECTIVES.size()))
                    + NOUNS.get(random.nextInt(NOUNS.size()))
                    + String.format("%04d", random.nextInt(10_000));

            if (!userRepository.existsByNickname(nickname)) {
                return new NicknameSuggestionResponse(nickname);
            }
        }

        throw new BusinessException(ErrorCode.NICKNAME_SUGGESTION_FAILED);
    }

    private String normalizeAndValidate(String rawNickname) {
        String nickname = rawNickname == null ? "" : rawNickname.trim();
        int length = nickname.codePointCount(0, nickname.length());
        if (length < 2 || length > 50) {
            throw new FieldBusinessException(
                    ErrorCode.NICKNAME_FORMAT_INVALID,
                    List.of(new FieldErrorDetail(
                            "nickname",
                            "2~50자의 유효한 닉네임을 입력해 주세요."
                    ))
            );
        }
        return nickname;
    }
}

