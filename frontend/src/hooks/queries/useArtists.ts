import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchArtists } from "../../services/artistApi";
import type { FetchArtistsParams } from "../../types/artist";
import { mapArtistItem } from "../../utils/mapArtist";

export const artistsQueryKey = ["artists"] as const;

type ArtistsInfiniteParams = Omit<FetchArtistsParams, "cursor">;

/** GET /artists — 커서 기반 무한 스크롤 */
export default function useArtists(params?: ArtistsInfiniteParams) {
	const { size = 20, shopCity, nickname } = params ?? {};
	const normalizedNickname = nickname?.trim() || undefined;
	const normalizedCity = shopCity?.trim() || undefined;

	return useInfiniteQuery({
		queryKey: [
			...artistsQueryKey,
			{ size, shopCity: normalizedCity, nickname: normalizedNickname },
		],
		initialPageParam: undefined as string | undefined,
		queryFn: async ({ pageParam }) => {
			const page = await fetchArtists({
				size,
				shopCity: normalizedCity,
				nickname: normalizedNickname,
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
