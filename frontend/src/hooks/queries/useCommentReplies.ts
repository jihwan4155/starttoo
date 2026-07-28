import { useQuery } from "@tanstack/react-query";
import { fetchReplies } from "../../services/communityApi";
import type { FetchCommentsParams } from "../../types/community";
import { mapCommentResponse } from "../../utils/mapPost";

export const commentRepliesQueryKey = (commentId: number) =>
	["comments", commentId, "replies"] as const;

/** GET /comments/{commentId}/replies — 펼쳤을 때만 조회 */
export default function useCommentReplies(
	commentId: number | undefined,
	params?: FetchCommentsParams,
) {
	return useQuery({
		queryKey: [...commentRepliesQueryKey(commentId ?? 0), params ?? {}],
		enabled: commentId != null,
		queryFn: async () => {
			const page = await fetchReplies(commentId!, params);
			return {
				...page,
				items: page.items.map((c) => mapCommentResponse(c)),
			};
		},
	});
}
