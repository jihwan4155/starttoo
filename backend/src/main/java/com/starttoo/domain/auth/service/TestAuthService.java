package com.starttoo.domain.auth.service;

import com.starttoo.common.exception.BusinessException;
import com.starttoo.common.exception.ErrorCode;
import com.starttoo.domain.auth.dto.TestAuthDtos.TestLoginResponse;
import com.starttoo.domain.auth.dto.TestAuthDtos.TestUser;
import com.starttoo.domain.user.entity.UserEntity;
import com.starttoo.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TestAuthService {

    private final UserRepository userRepository;
    private final JwtTokenService jwtTokenService;

    @Transactional(readOnly = true)
    public TestLoginResponse login(Long userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        validateAccount(user);

        var accessToken = jwtTokenService.issueAccessToken(user.getUserId(), user.getRole());
        return new TestLoginResponse(
                accessToken.accessToken(),
                accessToken.tokenType(),
                jwtTokenService.accessTokenSeconds(),
                new TestUser(
                        user.getUserId(),
                        user.getNickname(),
                        user.getRole(),
                        user.getAccountStatus()
                )
        );
    }

    private void validateAccount(UserEntity user) {
        if ("SUSPENDED".equals(user.getAccountStatus())) {
            throw new BusinessException(ErrorCode.ACCOUNT_SUSPENDED);
        }
        if ("WITHDRAWN".equals(user.getAccountStatus())) {
            throw new BusinessException(ErrorCode.ACCOUNT_WITHDRAWN);
        }
    }
}
