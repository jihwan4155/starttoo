import type { ArtistProfileResponse, UpdateArtistRequest } from "../../types/artist";
import type { UserArtistSummary } from "../../types/user";

export type ArtistShopFormValues = {
	shopName: string;
	shopCity: string;
	shopAddress: string;
	shopPhone: string;
	shopDetails: string;
};

const SHOP_FIELDS = [
	"shopName",
	"shopCity",
	"shopAddress",
	"shopPhone",
	"shopDetails",
] as const;

export const EMPTY_ARTIST_SHOP_FORM: ArtistShopFormValues = {
	shopName: "",
	shopCity: "",
	shopAddress: "",
	shopPhone: "",
	shopDetails: "",
};

/**
 * 화면에 채울 초기값 — 숍 프로필을 읽어왔으면 전부, 아니면 이름만.
 *
 * detail은 숍 전 필드를 담고 있고, summary(GET /users/me)는 숍 이름·인증 상태뿐이다.
 * 저장이 전체 덮어쓰기라서 이 초기값이 곧 "저장 버튼을 눌렀을 때 서버에 남을 값"이다.
 */
export function toArtistShopForm(
	detail: ArtistProfileResponse | null | undefined,
	summary: UserArtistSummary | null | undefined,
): ArtistShopFormValues {
	if (!detail) {
		return { ...EMPTY_ARTIST_SHOP_FORM, shopName: summary?.shopName ?? "" };
	}
	return {
		shopName: detail.shopName ?? "",
		shopCity: detail.shopCity ?? "",
		shopAddress: detail.shopAddress ?? "",
		shopPhone: detail.shopPhone ?? "",
		shopDetails: detail.shopDetails ?? "",
	};
}

/**
 * PATCH /artists/me/profile 본문 — 다섯 필드를 항상 함께 보낸다.
 *
 * 이름만 PATCH이고 서버는 받은 값을 그대로 대입한다. 본문에서 뺀 필드는 유지되지
 * 않고 NULL이 되므로 "바뀐 것만 보내기"는 나머지를 지우는 셈이 된다. 화면에 보이는
 * 값을 그대로 실어 보내는 것만 안전하다.
 */
export function buildArtistShopPatch(
	values: ArtistShopFormValues,
): UpdateArtistRequest {
	const body: UpdateArtistRequest = {};
	for (const field of SHOP_FIELDS) {
		body[field] = values[field].trim();
	}
	return body;
}

/** 프리필한 값에서 달라졌는지 — 그대로면 불필요한 덮어쓰기를 보내지 않는다 */
export function hasArtistShopChanges(
	values: ArtistShopFormValues,
	baseline: ArtistShopFormValues,
): boolean {
	return SHOP_FIELDS.some(
		(field) => values[field].trim() !== baseline[field].trim(),
	);
}
