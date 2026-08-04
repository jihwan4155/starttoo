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

/** Swagger ArtistDtos.ArtistPostSummary — 목록 카드의 작업물 미리보기 */
export type ArtistPostSummaryDto = {
	postSeq: number;
	/** 첫 번째 게시물 이미지의 단기 Presigned GET URL */
	imageUrl: string;
	likeCount: number;
};

/**
 * Swagger ArtistDtos.ArtistListItem
 *
 * 숍 필드는 중첩 객체가 아니라 평평하게 내려온다. 목록은 VERIFIED만 담기므로
 * verificationStatus는 항상 VERIFIED다.
 */
export type ArtistItem = {
	userSeq: number;
	nickname: string;
	profileImageSeq: number | null;
	profileImageUrl: string | null;
	shopName: string | null;
	shopCity: string | null;
	shopAddress: string | null;
	shopPhone: string | null;
	/** 영업시간·휴무일·예약 방식 자유 안내 */
	shopDetails: string | null;
	verificationStatus: string;
	followerCount: number;
	/** 최신 공개 게시물 최대 6개 */
	posts: ArtistPostSummaryDto[];
	regDttm: string | null;
};

/**
 * GET /artists 쿼리 파라미터
 *
 * 서버가 받는 것은 city·cursor·size뿐이다. 닉네임 검색은 이 API가 지원하지 않고
 * GET /search/artists(인증 아티스트 닉네임 검색)를 써야 한다.
 */
export type FetchArtistsParams = {
	/** 저장된 shopCity와 정확히 일치하는 항목만 반환한다 */
	city?: string;
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
