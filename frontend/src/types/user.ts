export type PublicProfileResponse = {
	userId: number;
	nickname: string;
	profileImageUrl: string | null;
	role: string;
	followerCount: number;
	followingCount: number;
	isFollowing: boolean;
	isMe: boolean;
	artist: {
		shopName: string | null;
		shopCity: string | null;
		shopAddress: string | null;
		shopPhone: string | null;
		businessHours: string | null;
		popularity: number | null;
		approvalStatus: string | null;
		rejectionReason: string | null;
		approvedAt: string | null;
	} | null;
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
