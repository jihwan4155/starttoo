package com.starttoo.domain.user.repository;

import com.starttoo.domain.user.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<UserEntity, Long> {
    boolean existsByNickname(String nickname);

    boolean existsByNicknameAndUserIdNot(String nickname, Long userId);

    Optional<UserEntity> findByOauthProviderAndOauthSubject(String oauthProvider, String oauthSubject);
}
