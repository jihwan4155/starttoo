import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchBookmarkedPosts } from "../../services/communityApi";
import useAuthStore from "../../store/useAuthStore";
import type { FetchPostsParams } from "../../types/community";
import { mapPostResponse } from "../../utils/mapPost";

export const bookmarkedPostsQueryKey = ["posts", "bookmarks"] as const;

type BookmarkedPostsParams = Omit<FetchPostsParams, "cursor">;

/** GET /users/me/bookmarked-posts */
export default function useBookmarkedPosts(params?: BookmarkedPostsParams) {
	const accessToken = useAuthStore((s) => s.accessToken);
	const userId = useAuthStore((s) => s.user?.userId);
	const { size = 20 } = params ?? {};

	return useInfiniteQuery({
		queryKey: [...bookmarkedPostsQueryKey, userId, { size }],
		enabled: Boolean(accessToken && userId),
		initialPageParam: undefined as string | undefined,
		queryFn: async ({ pageParam }) => {
			const page = await fetchBookmarkedPosts({
				size,
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
