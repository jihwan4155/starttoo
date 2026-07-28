import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchMyPosts } from "../../services/communityApi";
import useAuthStore from "../../store/useAuthStore";
import { mapPostResponse } from "../../utils/mapPost";

export const myPostsQueryKey = ["posts", "mine"] as const;

type MyPostsParams = {
	size?: number;
	status?: string;
};

/** GET /users/me/posts */
export default function useMyPosts(params?: MyPostsParams) {
	const accessToken = useAuthStore((s) => s.accessToken);
	const { size = 20, status = "ALL" } = params ?? {};

	return useInfiniteQuery({
		queryKey: [...myPostsQueryKey, { size, status }],
		enabled: Boolean(accessToken),
		initialPageParam: undefined as string | undefined,
		queryFn: async ({ pageParam }) => {
			const page = await fetchMyPosts({
				size,
				status,
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
