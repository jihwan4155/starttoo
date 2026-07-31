import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchMyPosts } from "../../services/communityApi";
import useAuthStore from "../../store/useAuthStore";
import { mapPostResponse } from "../../utils/mapPost";

export const myPostsQueryKey = ["posts", "mine"] as const;

type MyPostsParams = {
	size?: number;
};

/** GET /posts/me */
export default function useMyPosts(params?: MyPostsParams) {
	const accessToken = useAuthStore((s) => s.accessToken);
	const userId = useAuthStore((s) => s.user?.userId);
	const { size = 20 } = params ?? {};

	return useInfiniteQuery({
		queryKey: [...myPostsQueryKey, userId, { size }],
		enabled: Boolean(accessToken && userId),
		initialPageParam: undefined as string | undefined,
		queryFn: async ({ pageParam }) => {
			const page = await fetchMyPosts({
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
