import { useQuery } from "@tanstack/react-query";
import { fetchUserCollections } from "../../services/collectionApi";
import { mapCollectionToPlacement } from "../../utils/mapCollection";

export const userCollectionsQueryKey = (userId: number) =>
	["users", userId, "collections"] as const;

/**
 * GET /users/{userSeq}/collections
 *
 * 마네킹 한 장을 그리려면 배치 전체가 필요해서 페이지를 나누지 않고 한 번에 받는다
 * (size 최대 50). 배치가 그보다 많아지면 무한 쿼리로 바꿔야 한다.
 */
export default function useUserCollections(userId: number) {
	return useQuery({
		queryKey: userCollectionsQueryKey(userId),
		enabled: userId > 0,
		queryFn: async () => {
			const page = await fetchUserCollections(userId, { size: 50 });
			return page.items.map(mapCollectionToPlacement);
		},
	});
}
