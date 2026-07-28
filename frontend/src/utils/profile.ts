import defaultProfile from "../assets/images/default-profile.png";
import { MOCK_ARTISTS } from "../mocks/artists";

/** 기본 프로필 이미지(회색 실루엣) — 프로필 사진이 없을 때 공통 fallback */
export const DEFAULT_PROFILE_IMAGE = defaultProfile;

/** 닉네임 → 타투이스트 프로필 이미지 (커뮤니티·DM에서 아티스트 아바타를 일관되게 적용) */
const artistAvatarByName = new Map<string, string>(
	MOCK_ARTISTS.map((artist) => [artist.name, artist.avatarUrl]),
);

/**
 * 표시용 아바타 URL 해석
 * 1) 명시된 avatarUrl → 2) 닉네임이 타투이스트면 그 프로필 → 3) 기본 프로필
 */
export function resolveAvatar(
	avatarUrl?: string | null,
	nickname?: string,
): string {
	return (
		avatarUrl ||
		(nickname ? artistAvatarByName.get(nickname) : undefined) ||
		DEFAULT_PROFILE_IMAGE
	);
}

/** userId → 상세 프로필 경로 (number). mock/DM 등 nickname만 있을 때는 문자열 전달 가능 */
export function profilePath(userId: number): string;
export function profilePath(nickname: string): string;
export function profilePath(userIdOrNickname: number | string): string {
	if (typeof userIdOrNickname === "number") {
		return `/profile/${userIdOrNickname}`;
	}
	return `/profile/${encodeURIComponent(userIdOrNickname)}`;
}
