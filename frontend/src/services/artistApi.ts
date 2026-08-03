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

/**
 * 온보딩의 "타투이스트로 시작" — 숍 정보만 실어 위 API를 호출한다.
 *
 * 서버가 역할 승격을 해 주지 않으므로, 가입 시 role=USER로 만들어진 계정에서는
 * 403이 돌아온다. 역할 신청 API가 생기기 전까지는 실패해도 온보딩을 막지 않는다.
 */
export async function upsertArtistProfile(
	body: UpdateArtistRequest = {},
): Promise<void> {
	await updateArtistMe(body);
}
