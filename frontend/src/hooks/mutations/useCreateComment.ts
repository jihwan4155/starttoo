import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commentsQueryKey } from "../queries/useComments";
import { postQueryKey } from "../queries/usePost";
import { createComment } from "../../services/communityApi";
import type { Post, PostComment } from "../../types/community";
import {
	appendReplyToCache,
	bumpRootCommentReplyCount,
	patchPostInCache,
} from "../../utils/communityCache";
import { mapCommentResponse } from "../../utils/mapPost";

type CreateCommentVariables = {
	postId: number;
	content: string;
	/** 답글일 때 최상위(루트) 댓글 ID — Swagger parentCommentId */
	parentCommentId?: number;
};

type CreateCommentResult = {
	postId: number;
	comment: PostComment;
	parentCommentId?: number;
};

/** POST /posts/{postId}/comments — 루트 댓글·한 단계 답글 */
export default function useCreateComment() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			postId,
			content,
			parentCommentId,
		}: CreateCommentVariables): Promise<CreateCommentResult> => {
			const response = await createComment(postId, {
				content,
				parentCommentId,
			});
			return {
				postId,
				parentCommentId,
				comment: mapCommentResponse(response),
			};
		},
		onSuccess: ({ postId, comment, parentCommentId }) => {
			const detail = queryClient.getQueryData<Post>(postQueryKey(postId));
			patchPostInCache(queryClient, postId, {
				commentCount: (detail?.commentCount ?? 0) + 1,
			});

			if (parentCommentId != null) {
				appendReplyToCache(queryClient, parentCommentId, comment);
				bumpRootCommentReplyCount(queryClient, postId, parentCommentId);
				return;
			}

			queryClient.setQueriesData<{
				items: PostComment[];
				nextCursor: string | null;
				hasNext: boolean;
			}>({ queryKey: commentsQueryKey(postId) }, (old) => {
				if (!old || !Array.isArray(old.items)) return old;
				return { ...old, items: [comment, ...old.items] };
			});
		},
	});
}
