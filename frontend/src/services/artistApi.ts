import { api } from "./api";
import type { CursorPage } from "../types/community";
import type {
	ArtistItem,
	ArtistProfileResponse,
	FetchArtistsParams,
	UpdateArtistRequest,
} from "../types/artist";
import type { BeArtistProfile } from "../types/beUser";
import { mapArtistProfile } from "../utils/mapUser";

/** GET /artists — 타투이스트 검색·목록 */
export async function fetchArtists(
	params?: FetchArtistsParams,
): Promise<CursorPage<ArtistItem>> {
	const { data } = await api.get<CursorPage<ArtistItem>>("/artists", {
		params,
	});
	return data;
}

/**
 * PATCH /artists/me/profile — 숍 프로필 수정 후 갱신된 프로필을 돌려받는다
 *
 * users.role=ARTIST이고 artists 확장 행이 있는 계정만 통과한다 (그 외 403).
 * 즉 이 API로 아티스트 프로필을 새로 만들 수는 없다.
 *
 * 주의 — 이름만 PATCH이고 실제로는 전체 덮어쓰기다. 서버가 받은 값을 그대로
 * 대입하므로 본문에서 뺀 필드는 유지되지 않고 NULL이 된다. 다섯 필드를 항상
 * 함께 실어 보내야 한다 (buildArtistShopPatch 참고).
 */
export async function updateArtistMe(
	body: UpdateArtistRequest,
): Promise<ArtistProfileResponse> {
	const { data } = await api.patch<BeArtistProfile>(
		"/artists/me/profile",
		body,
	);
	return mapArtistProfile(data);
}

/** 나를 찾을 때까지 훑을 최대 페이지 수 — 목록이 커져도 요청이 무한정 늘지 않게 한다 */
const MY_PROFILE_LOOKUP_MAX_PAGES = 20;
const MY_PROFILE_LOOKUP_PAGE_SIZE = 50;

/**
 * 내 숍 프로필 조회 — GET /artists 목록에서 나를 찾는다.
 *
 * 내 숍 정보를 그대로 돌려주는 전용 조회 API가 없다. PATCH /artists/me/profile
 * 응답에는 전 필드가 들어 있지만, 그 PATCH가 전체 덮어쓰기라서 조회에 쓸 수 없다
 * (빈 본문으로 부르면 숍 정보가 전부 지워진다). 그래서 공개 목록에서 찾는다.
 *
 * 이 목록은 verificationStatus=VERIFIED만 담으므로 인증 전에는 나를 찾지 못하고
 * null이 돌아온다. 그때 화면은 GET /users/me가 주는 매장명·인증 상태만 보여준다.
 * 전용 GET(예: GET /artists/me/profile)이 생기면 이 함수만 갈아끼우면 된다.
 */
export async function fetchMyArtistProfile(
	userId: number,
): Promise<ArtistProfileResponse | null> {
	let cursor: string | undefined;

	for (let page = 0; page < MY_PROFILE_LOOKUP_MAX_PAGES; page += 1) {
		const { data } = await api.get<CursorPage<BeArtistProfile>>("/artists", {
			params: { size: MY_PROFILE_LOOKUP_PAGE_SIZE, cursor },
		});
		const mine = (data.items ?? []).find((item) => item.userSeq === userId);
		if (mine) return mapArtistProfile(mine);
		if (!data.hasNext || !data.nextCursor) return null;
		cursor = data.nextCursor;
	}

	return null;
}

/**
 * 온보딩의 "타투이스트로 시작" — 숍 정보만 실어 위 API를 호출한다.
 *
 * 서버가 역할 승격을 해 주지 않으므로, 가입 시 role=USER로 만들어진 계정에서는
 * 403이 돌아온다. 역할 신청 API가 생기기 전까지는 실패해도 온보딩을 막지 않는다.
 */
export async function upsertArtistProfile(
	body: UpdateArtistRequest,
): Promise<void> {
	await updateArtistMe(body);
}
