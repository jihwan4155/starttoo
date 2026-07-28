import { api } from "./api";
import type { CursorPage } from "../types/community";
import type { ArtistItem, FetchArtistsParams } from "../types/artist";

/** GET /artists — 타투이스트 검색·목록 */
export async function fetchArtists(
	params?: FetchArtistsParams,
): Promise<CursorPage<ArtistItem>> {
	const { data } = await api.get<CursorPage<ArtistItem>>("/artists", {
		params,
	});
	return data;
}
