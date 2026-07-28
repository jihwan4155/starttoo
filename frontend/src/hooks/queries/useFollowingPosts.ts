import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchFollowingPosts } from "../../services/communityApi";
import useAuthStore from "../../store/useAuthStore";
import type { FetchPostsParams } from "../../types/community";
import { mapPostResponse } from "../../utils/mapPost";

export const followingPostsQueryKey = ["posts", "following"] as const;

type FollowingPostsParams = Omit<FetchPostsParams, "cursor">;

/** GET /posts/following — 팔로잉 피드 */
export default function useFollowingPosts(params?: FollowingPostsParams) {
	const accessToken = useAuthStore((s) => s.accessToken);
	const { size = 20, sort = "LATEST" } = params ?? {};

	return useInfiniteQuery({
		queryKey: [...followingPostsQueryKey, { size, sort }],
		enabled: Boolean(accessToken),
		initialPageParam: undefined as string | undefined,
		queryFn: async ({ pageParam }) => {
			const page = await fetchFollowingPosts({
				size,
				sort,
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
