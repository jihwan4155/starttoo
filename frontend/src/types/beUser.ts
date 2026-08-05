/** 백엔드 Users DTO (Swagger /v1/users) */

export type BeArtistProfileSummary = {
	shopName: string | null;
	verificationStatus: string | null;
};

/** PATCH /artists/me/profile 응답 (Swagger ArtistProfile) */
export type BeArtistProfile = {
	userSeq: number;
	nickname: string;
	profileImageSeq: number | null;
	profileImageUrl: string | null;
	shopName: string | null;
	shopCity: string | null;
	shopAddress: string | null;
	shopPhone: string | null;
	shopDetails: string | null;
	verificationStatus: string | null;
	followerCount: number;
	regDttm: string | null;
};

export type BeMyProfile = {
	userSeq: number;
	nickname: string;
	phoneNumber: string;
	phoneVerifiedDttm: string | null;
	profileImageSeq: number | null;
	profileImageUrl: string | null;
	birthDate: string | null;
	gender: string | null;
	role: string;
	accountStatus: string;
	artistProfile: BeArtistProfileSummary | null;
	regDttm: string;
};

export type BePublicProfile = {
	userSeq: number;
	nickname: string;
	profileImageSeq: number | null;
	profileImageUrl: string | null;
	role: string;
	followerCount: number;
	followingCount: number;
	followedByMe: boolean;
	artistProfile: BeArtistProfileSummary | null;
};

/** nickname은 서버 required, birthDate·gender는 null로 해제 */
export type BeUpdateProfileRequest = {
	nickname: string;
	birthDate?: string | null;
	gender?: string | null;
};

export type BeProfileImageRequest = {
	imageSeq: number;
};

export type BeRelationState = {
	enabled: boolean;
};

/** GET /users/{userSeq}/followers · /following 항목 (Swagger RelationUser) */
export type BeRelationUser = {
	userSeq: number;
	nickname: string;
	role: string;
	profileImageSeq: number | null;
	profileImageUrl: string | null;
	followedByMe: boolean;
	/** role=ARTIST이고 인증까지 끝난 계정인지 */
	verified: boolean;
};

export type BeRecentSearchUpdateRequest = {
	operation: "ADD" | "REMOVE";
	term: string;
};
