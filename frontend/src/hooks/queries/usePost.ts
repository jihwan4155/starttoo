import { useQuery } from "@tanstack/react-query";
import { fetchPost } from "../../services/communityApi";
import { mapPostResponse } from "../../utils/mapPost";

export const postQueryKey = (postId: number) => ["posts", postId] as const;

/** GET /posts/{postId} — 상세 단건 */
export default function usePost(postId: number | undefined) {
	return useQuery({
		queryKey: postQueryKey(postId ?? 0),
		enabled: postId != null,
		queryFn: async () => mapPostResponse(await fetchPost(postId!)),
	});
}
