package com.starttoo.backend.artist.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Getter
@Builder
@Entity
@Table(name = "artists")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Artist {

    @Id
    @Column(name = "user_seq")
    private Integer userSeq;

    @Column(name = "shop_name", length = 100)
    private String shopName;

    @Column(name = "shop_city", length = 100)
    private String shopCity;

    @Column(name = "shop_address", length = 255)
    private String shopAddress;

    @Column(name = "shop_phone", length = 30)
    private String shopPhone;

    @Column(name = "shop_details", length = 1000)
    private String shopDetails;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 12)
    private VerificationStatus verificationStatus;

    @Column(name = "rejection_reason", length = 2000)
    private String rejectionReason;

    @Column(name = "verification_processed_dttm")
    private OffsetDateTime verificationProcessedDttm;

    @Column(name = "verification_processed_usr_seq")
    private Integer verificationProcessedUsrSeq;

    @Column(name = "reg_dttm", nullable = false)
    private OffsetDateTime regDttm;

    @Column(name = "mod_dttm", nullable = false)
    private OffsetDateTime modDttm;

    @Column(name = "mod_usr_seq", nullable = false)
    private Integer modUsrSeq;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted;

    public void updateShop(
            String shopName,
            String shopCity,
            String shopAddress,
            String shopPhone,
            String shopDetails,
            Integer modifierSeq
    ) {
        this.shopName = shopName;
        this.shopCity = shopCity;
        this.shopAddress = shopAddress;
        this.shopPhone = shopPhone;
        this.shopDetails = shopDetails;
        this.modUsrSeq = modifierSeq;
        this.modDttm = OffsetDateTime.now();
    }

    public void submitVerification(Integer modifierSeq) {
        this.verificationStatus = VerificationStatus.PENDING;
        this.rejectionReason = null;
        this.verificationProcessedDttm = null;
        this.verificationProcessedUsrSeq = null;
        this.modUsrSeq = modifierSeq;
        this.modDttm = OffsetDateTime.now();
    }

    public void processVerification(
            VerificationStatus status,
            String rejectionReason,
            Integer adminSeq
    ) {
        this.verificationStatus = status;
        this.rejectionReason = rejectionReason;
        this.verificationProcessedDttm = OffsetDateTime.now();
        this.verificationProcessedUsrSeq = adminSeq;
        this.modUsrSeq = adminSeq;
        this.modDttm = OffsetDateTime.now();
    }
}
