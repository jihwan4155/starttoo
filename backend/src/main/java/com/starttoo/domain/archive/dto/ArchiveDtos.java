package com.starttoo.domain.archive.dto;

import java.time.Instant;

public final class ArchiveDtos {
    private ArchiveDtos() {}
    public record ArchiveItem(
            Long tattooId, String originalImageUrl, String designImageUrl,
            String primaryStyle, String secondaryStyle, String rendering, Instant savedAt
    ) {}
    public record ArchiveToggleResponse(Long tattooId, boolean saved, Instant savedAt) {}
}
