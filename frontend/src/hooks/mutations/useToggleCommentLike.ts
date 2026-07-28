import { useMutation, useQueryClient } from "@tanstack/react-query";
import { likeComment, unlikeComment } from "../../services/communityApi";
import {
	patchCommentInCache,
	patchReplyInCache,
} from "../../utils/communityCache";

type ToggleCommentLikeVariables = {
	postId: number;
	commentId: number;
	liked: boolean;
	/** 답글일 때 최상위 댓글 ID — 답글 캐시 갱신용 */
	rootCommentId?: number;
};

/** POST/DELETE /comments/{commentId}/like */
export default function useToggleCommentLike() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			commentId,
			liked,
		}: ToggleCommentLikeVariables) => {
			return liked ? unlikeComment(commentId) : likeComment(commentId);
		},
		onSuccess: (data, variables) => {
			const patch = { liked: data.liked, likeCount: data.likeCount };
			patchCommentInCache(
				queryClient,
				variables.postId,
				data.commentId,
				patch,
			);
			if (variables.rootCommentId != null) {
				patchReplyInCache(
					queryClient,
					variables.rootCommentId,
					data.commentId,
					patch,
				);
			}
		},
	});
}
