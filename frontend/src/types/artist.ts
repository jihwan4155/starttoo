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
 *
 * users.role=ARTIST이고 artists 확장 행이 있는 계정만 통과한다.
 * USER 역할이거나 행이 없으면 서버가 403으로 거부한다 — 생성 용도로는 쓸 수 없다.
 * verificationStatus는 이 API로 바뀌지 않는다.
 */
export type UpdateArtistRequest = {
	shopName?: string;
	shopCity?: string;
	shopAddress?: string;
	shopPhone?: string;
	/** 영업시간·휴무일·예약 방식 자유 안내 */
	shopDetails?: string;
};

/** PATCH /artists/me/profile 응답 (Swagger ArtistProfile) */
export type ArtistProfileResponse = {
	userId: number;
	nickname: string;
	profileImageUrl: string | null;
	shopName: string | null;
	shopCity: string | null;
	shopAddress: string | null;
	shopPhone: string | null;
	shopDetails: string | null;
	verificationStatus: string | null;
	followerCount: number;
	createdAt: string | null;
};
