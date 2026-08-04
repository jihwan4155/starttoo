import { useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { likePost, unlikePost } from "../../services/communityApi";
import {
	bumpPostLikeInCache,
	patchPostInCache,
} from "../../utils/communityCache";
import {
	flushToggleCommits,
	isRateLimited,
	scheduleToggleCommit,
} from "../../utils/toggleCommitQueue";
import useCommunityStore from "../../store/useCommunityStore";
import { ApiError } from "../../services/api";

const KEY_PREFIX = "post-like:";

/**
 * PUT/DELETE /posts/{postSeq}/like
 *
 * toggle()은 하트와 좋아요 수를 즉시 바꾸고(낙관적 업데이트), 실제 요청은
 * 연타가 멈춘 뒤 최종 상태 하나만 보낸다. 실패하면 조용히 원복한다.
 */
export default function useTogglePostLike() {
	const queryClient = useQueryClient();

	const { mutate, isPending } = useMutation({
		mutationFn: async ({
			postId,
			nextLiked,
		}: {
			postId: number;
			nextLiked: boolean;
		}) => (nextLiked ? likePost(postId) : unlikePost(postId)),
		onSuccess: (data) => {
			if (data?.postId == null) return;
			useCommunityStore.getState().setLiked(data.postId, data.liked);
			patchPostInCache(queryClient, data.postId, {
				liked: data.liked,
				...(data.likeCount != null ? { likeCount: data.likeCount } : {}),
			});
		},
		onError: (error, { postId, nextLiked }) => {
			// 낙관적으로 반영한 ±1을 되돌린다
			useCommunityStore.getState().setLiked(postId, !nextLiked);
			bumpPostLikeInCache(queryClient, postId, !nextLiked, nextLiked ? -1 : 1);
			// 연타로 인한 429는 하트가 되돌아가는 것으로 충분 — 알림창까지 띄우지 않는다
			if (isRateLimited(error)) return;
			window.alert(
				error instanceof ApiError
					? error.message
					: "좋아요 처리에 실패했습니다.",
			);
		},
	});

	// 화면을 벗어나기 전에 예약된 요청을 흘려보낸다
	useEffect(() => () => flushToggleCommits(KEY_PREFIX), []);

	const toggle = useCallback(
		(postId: number, currentLiked: boolean) => {
			const nextLiked = !currentLiked;
			useCommunityStore.getState().setLiked(postId, nextLiked);
			bumpPostLikeInCache(queryClient, postId, nextLiked, nextLiked ? 1 : -1);
			scheduleToggleCommit({
				key: `${KEY_PREFIX}${postId}`,
				base: currentLiked,
				desired: nextLiked,
				commit: (desired) => mutate({ postId, nextLiked: desired }),
			});
		},
		[mutate, queryClient],
	);

	return { toggle, isPending };
}
