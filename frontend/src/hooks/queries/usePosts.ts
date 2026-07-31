import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPosts } from "../../services/communityApi";
import type { FetchPostsParams } from "../../types/community";
import { mapPostResponse } from "../../utils/mapPost";

export const postsQueryKey = ["posts"] as const;

type PostsInfiniteParams = Omit<FetchPostsParams, "cursor">;

/** GET /posts — 커서 기반 무한 스크롤 */
export default function usePosts(params?: PostsInfiniteParams) {
	const { size = 20, authorSeq } = params ?? {};

	return useInfiniteQuery({
		queryKey: [...postsQueryKey, { size, authorSeq }],
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
