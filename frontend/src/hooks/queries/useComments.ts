import { useQuery } from "@tanstack/react-query";
import { fetchComments } from "../../services/communityApi";
import type { FetchCommentsParams } from "../../types/community";
import { mapCommentResponse } from "../../utils/mapPost";

export const commentsQueryKey = (postId: number) =>
	["posts", postId, "comments"] as const;

/** GET /posts/{postId}/comments — 최상위 댓글 목록 */
export default function useComments(
	postId: number | undefined,
	params?: FetchCommentsParams,
) {
	return useQuery({
		queryKey: [...commentsQueryKey(postId ?? 0), params ?? {}],
		enabled: postId != null,
		queryFn: async () => {
			const page = await fetchComments(postId!, params);
			return {
				...page,
				items: page.items.map((c) => mapCommentResponse(c)),
			};
		},
	});
}
