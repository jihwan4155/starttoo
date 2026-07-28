package com.starttoo.domain.tattoo.dto;

import java.time.Instant;

public final class TattooDtos {
    private TattooDtos() {}

    public record Owner(Long userId, String nickname) {}
    public record Image(Long imageId, String imageUrl) {}
    public record TattooDetail(
            Long tattooId, Owner owner, String sourceType, Image image,
            String primaryStyle, String secondaryStyle, String color, String rendering,
            boolean hasDesign, String designImageUrl, Instant createdAt, Instant updatedAt
    ) {}
    public record TattooImageResponse(Long tattooId, Long imageId, String imageUrl) {}
    public record TattooDesignResponse(
            Long tattooId, Long imageId, String imageUrl, Instant createdAt, Instant updatedAt
    ) {}
}
