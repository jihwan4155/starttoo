export type UserArtistInfo = {
	shopName: string | null;
	shopCity: string | null;
	shopAddress: string | null;
	shopPhone: string | null;
	businessHours: string | null;
	popularity: number | null;
	approvalStatus: string | null;
	rejectionReason: string | null;
	approvedAt: string | null;
};

/** GET /users/me */
export type MeResponse = {
	userId: number;
	email: string;
	nickname: string;
	profileImageUrl: string | null;
	birthDate: string | null;
	gender: string | null;
	role: string;
	accountStatus: string;
	followerCount: number;
	followingCount: number;
	artist: UserArtistInfo | null;
	createdAt: string;
};

/** PATCH /users/me */
export type UpdateMeRequest = {
	nickname?: string;
	birthDate?: string;
	removeBirthDate?: boolean;
	gender?: string;
	removeGender?: boolean;
};

export type UpdateMeResponse = {
	userId: number;
	nickname: string;
	birthDate: string | null;
	gender: string | null;
	role: string;
	updatedAt: string;
};

/** PUT /users/me/profile-image */
export type ProfileImageRequest = {
	profileImageObjectKey: string;
};

export type ProfileImageResponse = {
	profileImageUrl: string;
	updatedAt: string;
};

export type PublicProfileResponse = {
	userId: number;
	nickname: string;
	profileImageUrl: string | null;
	role: string;
	followerCount: number;
	followingCount: number;
	isFollowing: boolean;
	isMe: boolean;
	artist: UserArtistInfo | null;
};

export type FollowResponse = {
	userId: number;
	following: boolean;
	followerCount: number;
};

export type RecentSearchItem = {
	recentSearchId: number;
	keyword: string;
	searchedAt: string;
};

export type RecentSearchListResponse = {
	items: RecentSearchItem[];
};

export type RecentSearchRequest = {
	keyword: string;
};
