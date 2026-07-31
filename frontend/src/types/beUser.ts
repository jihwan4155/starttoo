/** 백엔드 Users DTO (Swagger /v1/users) */

export type BeArtistProfileSummary = {
	shopName: string | null;
	verificationStatus: string | null;
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

export type BeUpdateProfileRequest = {
	nickname?: string;
	birthDate?: string | null;
	gender?: string | null;
};

export type BeProfileImageRequest = {
	imageSeq: number;
};

export type BeRelationState = {
	enabled: boolean;
};

export type BeRecentSearchUpdateRequest = {
	operation: "ADD" | "REMOVE";
	term: string;
};
