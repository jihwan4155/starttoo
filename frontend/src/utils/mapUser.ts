import type {
	BeArtistProfile,
	BeArtistProfileSummary,
	BeMyProfile,
	BePublicProfile,
} from "../types/beUser";
import type { ArtistProfileResponse } from "../types/artist";
import type {
	MeResponse,
	PublicProfileResponse,
	UserArtistSummary,
} from "../types/user";

function mapArtistSummary(
	artist: BeArtistProfileSummary | null | undefined,
): UserArtistSummary | null {
	if (!artist) return null;
	return {
		shopName: artist.shopName ?? null,
		verificationStatus: artist.verificationStatus ?? null,
	};
}

/** GET /users/me → UI MeResponse */
export function mapMyProfile(dto: BeMyProfile): MeResponse {
	return {
		userId: dto.userSeq,
		nickname: dto.nickname,
		phoneNumber: dto.phoneNumber,
		phoneVerifiedAt: dto.phoneVerifiedDttm ?? null,
		profileImageUrl: dto.profileImageUrl ?? null,
		profileImageSeq: dto.profileImageSeq ?? null,
		birthDate: dto.birthDate ?? null,
		gender: dto.gender ?? null,
		role: dto.role,
		accountStatus: dto.accountStatus,
		artist: mapArtistSummary(dto.artistProfile),
		createdAt: dto.regDttm ?? null,
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
		profileImageUrl: dto.profileImageUrl ?? null,
		role: dto.role,
		followerCount: dto.followerCount ?? 0,
		followingCount: dto.followingCount ?? 0,
		isFollowing: dto.followedByMe ?? false,
		isMe: viewerUserId != null && viewerUserId === dto.userSeq,
		artist: mapArtistSummary(dto.artistProfile),
	};
}

/** PATCH /artists/me/profile → UI ArtistProfileResponse */
export function mapArtistProfile(dto: BeArtistProfile): ArtistProfileResponse {
	return {
		userId: dto.userSeq,
		nickname: dto.nickname,
		profileImageUrl: dto.profileImageUrl ?? null,
		shopName: dto.shopName ?? null,
		shopCity: dto.shopCity ?? null,
		shopAddress: dto.shopAddress ?? null,
		shopPhone: dto.shopPhone ?? null,
		shopDetails: dto.shopDetails ?? null,
		verificationStatus: dto.verificationStatus ?? null,
		followerCount: dto.followerCount ?? 0,
		createdAt: dto.regDttm ?? null,
	};
}
