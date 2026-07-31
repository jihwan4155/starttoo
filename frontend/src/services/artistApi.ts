import { api } from "./api";
import type { CursorPage } from "../types/community";
import type {
	ArtistItem,
	ArtistProfileResponse,
	FetchArtistsParams,
	UpdateArtistProfileRequest,
	UpdateArtistRequest,
} from "../types/artist";

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
 * PATCH /artists/me/profile — 아티스트 프로필 생성 또는 숍 정보 수정
 *
 * 프로필이 없으면 UNVERIFIED 상태로 만들어 준다. 가입 온보딩에서 "타투이스트"를
 * 고르면 빈 본문으로 호출해 신청 상태만 만든다. 숍 정보는 나중에 채운다.
 * Bearer 토큰이 필요하므로 가입 완료로 세션을 세운 뒤에 호출해야 한다.
 */
export async function upsertArtistProfile(
	body: UpdateArtistProfileRequest = {},
): Promise<void> {
	await api.patch("/artists/me/profile", body);
}

/** PATCH /artists/me — 로그인 타투이스트 숍 프로필 부분 수정 */
export async function updateArtistMe(
	body: UpdateArtistRequest,
): Promise<ArtistProfileResponse> {
	const { data } = await api.patch<ArtistProfileResponse>("/artists/me", body);
	return data;
}
