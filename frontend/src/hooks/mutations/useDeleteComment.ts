import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteComment } from "../../services/communityApi";
import { postQueryKey } from "../queries/usePost";
import type { Post } from "../../types/community";
import {
	patchCommentInCache,
	patchPostInCache,
	removeCommentFromCache,
	removeReplyFromCache,
} from "../../utils/communityCache";

type DeleteCommentVariables = {
	postId: number;
	commentId: number;
	/** 답글 삭제 시 루트 댓글 ID */
	rootCommentId?: number;
};

/** DELETE /comments/{commentId} */
export default function useDeleteComment() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ commentId }: DeleteCommentVariables) =>
			deleteComment(commentId),
		onSuccess: (_data, { postId, commentId, rootCommentId }) => {
			const detail = queryClient.getQueryData<Post>(postQueryKey(postId));
			patchPostInCache(queryClient, postId, {
				commentCount: Math.max(0, (detail?.commentCount ?? 1) - 1),
			});

			if (rootCommentId != null) {
				removeReplyFromCache(queryClient, rootCommentId, commentId);
				const commentsData = queryClient.getQueriesData<{
					items: { id: number; replyCount?: number }[];
				}>({ queryKey: ["posts", postId, "comments"] });
				const rootComment = commentsData
					.flatMap(([, data]) => data?.items ?? [])
					.find((item) => item.id === rootCommentId);
				if (rootComment) {
					patchCommentInCache(queryClient, postId, rootCommentId, {
						replyCount: Math.max(0, (rootComment.replyCount ?? 1) - 1),
					});
				}
				return;
			}

			removeCommentFromCache(queryClient, postId, commentId);
		},
	});
}
