import { useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { likeComment, unlikeComment } from "../../services/communityApi";
import {
	bumpCommentLikeInCache,
	patchCommentInCache,
	patchReplyInCache,
} from "../../utils/communityCache";
import {
	flushToggleCommits,
	isRateLimited,
	scheduleToggleCommit,
} from "../../utils/toggleCommitQueue";
import { notifyActionError } from "../../utils/actionError";

const KEY_PREFIX = "comment-like:";

type CommentTarget = {
	postId: number;
	commentId: number;
	/** 답글일 때 최상위 댓글 ID — 답글 캐시 갱신용 */
	rootCommentId?: number;
};

/**
 * PUT/DELETE /comments/{commentSeq}/like
 *
 * 피드 좋아요와 같은 방식 — 하트와 좋아요 수를 즉시 반영하고, 요청은 연타가
 * 멈춘 뒤 최종 상태 하나만 보낸다.
 */
export default function useToggleCommentLike() {
	const queryClient = useQueryClient();

	const { mutate, isPending } = useMutation({
		mutationFn: async ({
			commentId,
			nextLiked,
		}: CommentTarget & { nextLiked: boolean }) =>
			nextLiked ? likeComment(commentId) : unlikeComment(commentId),
		onSuccess: (data, variables) => {
			const patch = {
				liked: data.liked,
				...(data.likeCount != null ? { likeCount: data.likeCount } : {}),
			};
			patchCommentInCache(queryClient, variables.postId, data.commentId, patch);
			if (variables.rootCommentId != null) {
				patchReplyInCache(
					queryClient,
					variables.rootCommentId,
					data.commentId,
					patch,
				);
			}
		},
		onError: (error, variables) => {
			// 낙관적으로 반영한 ±1을 되돌린다
			bumpCommentLikeInCache(queryClient, {
				...variables,
				liked: !variables.nextLiked,
				delta: variables.nextLiked ? -1 : 1,
			});
			// 연타로 인한 429는 하트가 되돌아가는 것으로 충분
			if (isRateLimited(error)) return;
			notifyActionError(error, "댓글 좋아요 처리에 실패했습니다.");
		},
	});

	// 모달을 닫기 전에 예약된 요청을 흘려보낸다
	useEffect(() => () => flushToggleCommits(KEY_PREFIX), []);

	const toggle = useCallback(
		(target: CommentTarget, currentLiked: boolean) => {
			const nextLiked = !currentLiked;
			bumpCommentLikeInCache(queryClient, {
				...target,
				liked: nextLiked,
				delta: nextLiked ? 1 : -1,
			});
			scheduleToggleCommit({
				key: `${KEY_PREFIX}${target.commentId}`,
				base: currentLiked,
				desired: nextLiked,
				commit: (desired) => mutate({ ...target, nextLiked: desired }),
			});
		},
		[mutate, queryClient],
	);

	return { toggle, isPending };
}
