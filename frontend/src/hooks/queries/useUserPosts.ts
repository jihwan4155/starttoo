import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchUserPosts } from "../../services/communityApi";
import { mapPostResponse } from "../../utils/mapPost";

export const userPostsQueryKey = ["posts", "user"] as const;

type UserPostsParams = {
	userId: number;
	size?: number;
};

/** GET /users/{userId}/posts */
export default function useUserPosts({ userId, size = 20 }: UserPostsParams) {
	return useInfiniteQuery({
		queryKey: [...userPostsQueryKey, userId, { size }],
		enabled: userId > 0,
		initialPageParam: undefined as string | undefined,
		queryFn: async ({ pageParam }) => {
			const page = await fetchUserPosts(userId, {
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
