package com.starttoo.domain.artist.entity;

import com.starttoo.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "tattoo_artists")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class TattooArtistEntity extends BaseTimeEntity {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "shop_name", length = 100)
    private String shopName;

    @Column(name = "shop_city", length = 30)
    private String shopCity;

    @Column(name = "shop_address", length = 500)
    private String shopAddress;

    @Column(name = "shop_phone", length = 30)
    private String shopPhone;

    @Column(name = "business_hours", length = 500)
    private String businessHours;

    @Builder.Default
    @Column(name = "popularity", nullable = false, precision = 8, scale = 4)
    private BigDecimal popularity = new BigDecimal("1.0000");

    @Builder.Default
    @Column(name = "approval_status", nullable = false, length = 20)
    private String approvalStatus = "UNVERIFIED";

    @Column(name = "rejection_reason", length = 2000)
    private String rejectionReason;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    public void updateProfile(
            String shopName,
            String shopCity,
            String shopAddress,
            String shopPhone,
            String businessHours
    ) {
        this.shopName = shopName;
        this.shopCity = shopCity;
        this.shopAddress = shopAddress;
        this.shopPhone = shopPhone;
        this.businessHours = businessHours;
    }

    public void changeApprovalStatus(
            String approvalStatus,
            String rejectionReason,
            LocalDateTime approvedAt
    ) {
        this.approvalStatus = approvalStatus;
        this.rejectionReason = rejectionReason;
        this.approvedAt = approvedAt;
    }
}
