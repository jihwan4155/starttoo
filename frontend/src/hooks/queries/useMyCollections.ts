import { useQuery } from "@tanstack/react-query";
import { fetchMyCollections } from "../../services/collectionApi";
import useAuthStore from "../../store/useAuthStore";
import { mapCollectionToPlacement } from "../../utils/mapCollection";

export const myCollectionsQueryKey = ["collections", "me"] as const;

/**
 * GET /collections — 내 컬렉션 배치
 *
 * 마네킹 한 장에 배치 전체가 필요해 페이지를 나누지 않고 한 번에 받는다 (size 최대 50).
 */
export default function useMyCollections() {
	const accessToken = useAuthStore((s) => s.accessToken);

	return useQuery({
		queryKey: myCollectionsQueryKey,
		enabled: Boolean(accessToken),
		queryFn: async () => {
			const page = await fetchMyCollections({ size: 50 });
			return page.items.map(mapCollectionToPlacement);
		},
	});
}
