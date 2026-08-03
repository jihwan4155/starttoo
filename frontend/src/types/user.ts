/**
 * GET /users/me · GET /users/{userSeq} 의 artistProfile.
 * 서버 ArtistProfileSummary는 이 두 필드가 전부다. 숍 도시·주소·전화·안내는
 * PATCH /artists/me/profile 응답에만 들어 있고 조회 API가 아직 없다.
 */
export type UserArtistSummary = {
	shopName: string | null;
	verificationStatus: string | null;
};

/** GET /users/me (Swagger MyProfile) */
export type MeResponse = {
	userId: number;
	nickname: string;
	phoneNumber: string;
	phoneVerifiedAt: string | null;
	profileImageUrl: string | null;
	profileImageSeq: number | null;
	birthDate: string | null;
	gender: string | null;
	role: string;
	accountStatus: string;
	/** role=ARTIST이고 artists 확장 행이 있을 때만 내려온다 */
	artist: UserArtistSummary | null;
	createdAt: string | null;
};

/**
 * PATCH /users/me
 *
 * nickname은 서버 필수(required)라 바꾸지 않아도 현재 값을 그대로 실어 보낸다.
 * birthDate·gender는 null을 보내 해제한다.
 */
export type UpdateMeRequest = {
	nickname: string;
	birthDate?: string | null;
	gender?: string | null;
};

/** GET /users/{userSeq} (Swagger PublicProfile) */
export type PublicProfileResponse = {
	userId: number;
	nickname: string;
	profileImageUrl: string | null;
	role: string;
	followerCount: number;
	followingCount: number;
	isFollowing: boolean;
	isMe: boolean;
	artist: UserArtistSummary | null;
};

/** PUT·DELETE /users/{userSeq}/follow */
export type FollowResponse = {
	userId: number;
	following: boolean;
};
