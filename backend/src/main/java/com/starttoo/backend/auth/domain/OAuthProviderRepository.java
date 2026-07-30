package com.starttoo.backend.auth.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OAuthProviderRepository extends JpaRepository<OAuthProvider, Integer> {
    Optional<OAuthProvider> findByProviderCodeAndActiveTrue(String providerCode);
}
