package com.starttoo.domain.search.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "user_recent_searches")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class UserRecentSearchEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "recent_search_id")
    private Long recentSearchId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "keyword", nullable = false, length = 100)
    private String keyword;

    @UpdateTimestamp
    @Column(name = "searched_at", nullable = false)
    private LocalDateTime searchedAt;

    public void touch(LocalDateTime now) {
        this.searchedAt = now;
    }
}
