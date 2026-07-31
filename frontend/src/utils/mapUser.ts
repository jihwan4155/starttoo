import type {
	BeArtistProfileSummary,
	BeMyProfile,
	BePublicProfile,
} from "../types/beUser";
import type { MeResponse, PublicProfileResponse, UserArtistInfo } from "../types/user";

function mapArtistSummary(
	artist: BeArtistProfileSummary | null,
): UserArtistInfo | null {
	if (!artist) return null;
	return {
		shopName: artist.shopName,
		shopCity: null,
		shopAddress: null,
		shopPhone: null,
		businessHours: null,
		popularity: null,
		approvalStatus: artist.verificationStatus,
		rejectionReason: null,
		approvedAt: null,
	};
}

/** GET /users/me → UI MeResponse */
export function mapMyProfile(dto: BeMyProfile): MeResponse {
	return {
		userId: dto.userSeq,
		email: "",
		nickname: dto.nickname,
		profileImageUrl: dto.profileImageUrl,
		birthDate: dto.birthDate,
		gender: dto.gender,
		role: dto.role,
		accountStatus: dto.accountStatus,
		followerCount: 0,
		followingCount: 0,
		artist: mapArtistSummary(dto.artistProfile),
		createdAt: dto.regDttm,
	};
}

/** GET /users/{userSeq} → UI PublicProfileResponse */
export function mapPublicProfile(
	dto: BePublicProfile,
	viewerUserId?: number | null,
): PublicProfileResponse {
	return {
		userId: dto.userSeq,
		nickname: dto.nickname,
		profileImageUrl: dto.profileImageUrl,
		role: dto.role,
		followerCount: dto.followerCount,
		followingCount: dto.followingCount,
		isFollowing: dto.followedByMe,
		isMe: viewerUserId != null && viewerUserId === dto.userSeq,
		artist: mapArtistSummary(dto.artistProfile),
	};
}
