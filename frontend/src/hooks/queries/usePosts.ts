import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPosts } from "../../services/communityApi";
import type { FetchPostsParams } from "../../types/community";
import { mapPostResponse } from "../../utils/mapPost";

export const postsQueryKey = ["posts"] as const;

type PostsInfiniteParams = Omit<FetchPostsParams, "cursor"> & {
	/** 끄면 요청을 보내지 않는다 — 검색 중에는 탐색 그리드를 받아올 이유가 없다 */
	enabled?: boolean;
};

/** GET /posts — 커서 기반 무한 스크롤 */
export default function usePosts(params?: PostsInfiniteParams) {
	const { size = 20, authorSeq, enabled = true } = params ?? {};

	return useInfiniteQuery({
		queryKey: [...postsQueryKey, { size, authorSeq }],
		enabled,
		initialPageParam: undefined as string | undefined,
		queryFn: async ({ pageParam }) => {
			const page = await fetchPosts({
				size,
				authorSeq,
				cursor: pageParam,
			});
			return {
				...page,
				items: page.items.map(mapPostResponse),
			};
		},
		getNextPageParam: (lastPage) =>
			lastPage.hasNext && lastPage.nextCursor
				? lastPage.nextCursor
				: undefined,
	});
}
