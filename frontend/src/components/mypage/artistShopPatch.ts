import type { UpdateArtistRequest } from "../../types/artist";
import type { UserArtistSummary } from "../../types/user";

export type ArtistShopFormValues = {
	shopName: string;
	shopCity: string;
	shopAddress: string;
	shopPhone: string;
	shopDetails: string;
};

/** 조회 API가 없어 현재 값을 알 수 없는 필드 — 빈 칸은 "유지"로 취급한다 */
const WRITE_ONLY_FIELDS = [
	"shopCity",
	"shopAddress",
	"shopPhone",
	"shopDetails",
] as const;

/**
 * PATCH /artists/me/profile 본문을 만든다 — 바뀐 필드만 담는다.
 *
 * 숍 이름은 프로필 조회로 현재 값을 알 수 있어 지우는 것(빈 문자열)까지 반영한다.
 * 나머지 필드는 서버 값을 읽을 방법이 없어, 빈 칸이면 "지우기"가 아니라
 * "건드리지 않기"다. 안 그러면 이 화면을 열고 저장할 때마다 서버 값이 날아간다.
 */
export function buildArtistShopPatch(
	values: ArtistShopFormValues,
	artist: UserArtistSummary,
): UpdateArtistRequest {
	const body: UpdateArtistRequest = {};

	const trimmedName = values.shopName.trim();
	if (trimmedName !== (artist.shopName ?? "")) body.shopName = trimmedName;

	for (const field of WRITE_ONLY_FIELDS) {
		const trimmed = values[field].trim();
		if (trimmed) body[field] = trimmed;
	}

	return body;
}
