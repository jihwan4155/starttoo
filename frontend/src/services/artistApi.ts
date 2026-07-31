import { api } from "./api";
import type { CursorPage } from "../types/community";
import type {
	ArtistItem,
	ArtistProfileResponse,
	FetchArtistsParams,
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

/** PATCH /artists/me — 로그인 타투이스트 숍 프로필 부분 수정 */
export async function updateArtistMe(
	body: UpdateArtistRequest,
): Promise<ArtistProfileResponse> {
	const { data } = await api.patch<ArtistProfileResponse>(
		"/artists/me/profile",
		body,
	);
	return data;
}
