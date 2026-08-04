import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchArtists } from "../../services/artistApi";
import type { FetchArtistsParams } from "../../types/artist";
import { mapArtistItem } from "../../utils/mapArtist";

export const artistsQueryKey = ["artists"] as const;

type ArtistsInfiniteParams = Omit<FetchArtistsParams, "cursor"> & {
	enabled?: boolean;
};

/** GET /artists — 커서 기반 무한 스크롤. city는 정확 일치 필터 */
export default function useArtists(params?: ArtistsInfiniteParams) {
	const { size = 20, city, enabled = true } = params ?? {};
	const normalizedCity = city?.trim() || undefined;

	return useInfiniteQuery({
		queryKey: [...artistsQueryKey, { size, city: normalizedCity }],
		enabled,
		initialPageParam: undefined as string | undefined,
		queryFn: async ({ pageParam }) => {
			const page = await fetchArtists({
				size,
				city: normalizedCity,
				cursor: pageParam,
			});
			return {
				...page,
				items: page.items.map(mapArtistItem),
			};
		},
		getNextPageParam: (lastPage) =>
			lastPage.hasNext && lastPage.nextCursor
				? lastPage.nextCursor
				: undefined,
	});
}
