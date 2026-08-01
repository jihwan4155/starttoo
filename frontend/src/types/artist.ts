/** UI용 타투이스트 카드 (화면·목업) */
export type Artist = {
	id: number;
	name: string;
	/** 현재 영업 중 여부 */
	isOpen: boolean;
	/** 영업 시간 표시 문구 (예: "22:00에 영업 종료") */
	hoursLabel: string;
	/** 현재 위치 기준 거리 (km, null이면 미표시) */
	distanceKm: number | null;
	address: string;
	/** 작업 장르 태그 */
	categories: string[];
	/** 프로필 사진 URL */
	avatarUrl: string;
	/** 대표 작업물 이미지 URL */
	imageUrls: string[];
};

/* ─── Backend DTO (Swagger GET /artists) ─── */

export type ArtistShopDto = {
	shopName: string | null;
	shopCity: string | null;
	shopAddress: string | null;
	shopPhone: string | null;
	businessHours: string | null;
};

export type ArtistFeedPreviewDto = {
	postId: number;
	imageUrl: string;
	likeCount: number;
};

export type ArtistItem = {
	userId: number;
	nickname: string;
	profileImageUrl: string | null;
	shop: ArtistShopDto | null;
	approvalStatus: string;
	popularity: number;
	followerCount: number;
	isFollowing: boolean;
	isMe: boolean;
	feedPreviews: ArtistFeedPreviewDto[];
};

export type FetchArtistsParams = {
	shopCity?: string;
	nickname?: string;
	cursor?: string;
	size?: number;
};

/**
 * PATCH /artists/me/profile 요청 (전부 선택)
 * 빈 본문으로 호출하면 아티스트 프로필이 UNVERIFIED 상태로 생성된다.
 */
export type UpdateArtistProfileRequest = {
	shopName?: string;
	shopCity?: string;
	shopAddress?: string;
	shopPhone?: string;
	shopDetails?: string;
};

/** PATCH /artists/me 요청 */
export type UpdateArtistRequest = {
	shopName?: string;
	shopCity?: string;
	shopAddress?: string;
	shopPhone?: string;
	businessHours?: string;
};

/** PATCH /artists/me 응답 */
export type ArtistProfileResponse = {
	userId: number;
	shopName: string | null;
	shopCity: string | null;
	shopAddress: string | null;
	shopPhone: string | null;
	businessHours: string | null;
	popularity: number | null;
	approvalStatus: string | null;
	rejectionReason: string | null;
	approvedAt: string | null;
	updatedAt: string;
};
