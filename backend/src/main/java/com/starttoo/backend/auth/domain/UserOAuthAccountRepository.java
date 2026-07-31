package com.starttoo.backend.auth.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserOAuthAccountRepository extends JpaRepository<UserOAuthAccount, Long> {
    Optional<UserOAuthAccount> findByOauthProviderSeqAndProviderSubjectAndDeletedFalse(
            Integer oauthProviderSeq,
            String providerSubject
    );

    Optional<UserOAuthAccount> findFirstByUserSeqAndDeletedFalseOrderByUserOauthAccountSeqAsc(
            Integer userSeq
    );
}
