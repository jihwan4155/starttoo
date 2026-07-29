import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hidePost, unhidePost } from "../../services/communityApi";
import { ApiError } from "../../services/api";
import useAuthStore from "../../store/useAuthStore";
import useCommunityStore from "../../store/useCommunityStore";
import {
	removePostFromCache,
} from "../../utils/communityCache";
import { postsQueryKey } from "../queries/usePosts";
import { followingPostsQueryKey } from "../queries/useFollowingPosts";

type HidePostVariables = {
	postId: number;
	/** true = 현재 숨김 상태 → 숨김 취소, false = 숨김 처리 */
	hidden: boolean;
};

function isPostNotFoundError(error: unknown): boolean {
	return error instanceof ApiError && error.code === "POST_NOT_FOUND";
}

/** POST/DELETE /posts/{postId}/hidden */
export default function useHidePost() {
	const queryClient = useQueryClient();
	const userId = useAuthStore((s) => s.user?.userId);
	const markHidden = useCommunityStore((s) => s.markHidden);
	const clearHidden = useCommunityStore((s) => s.clearHidden);
	const markHiddenOverlay = useCommunityStore((s) => s.markHiddenOverlay);
	const clearHiddenOverlay = useCommunityStore((s) => s.clearHiddenOverlay);

	return useMutation({
		mutationFn: async ({ postId, hidden }: HidePostVariables) => {
			return hidden ? unhidePost(postId) : hidePost(postId);
		},
		onMutate: ({ postId, hidden }) => {
			if (userId == null) return;
			if (hidden) {
				clearHidden(userId, postId);
				clearHiddenOverlay(postId);
			} else {
				markHidden(userId, postId);
				markHiddenOverlay(postId);
			}
		},
		onError: (error, { postId, hidden }) => {
			if (!hidden && isPostNotFoundError(error) && userId != null) {
				markHidden(userId, postId);
				clearHiddenOverlay(postId);
				removePostFromCache(queryClient, postId);
				return;
			}
			if (userId == null) return;
			if (hidden) {
				markHidden(userId, postId);
				markHiddenOverlay(postId);
			} else {
				clearHidden(userId, postId);
				clearHiddenOverlay(postId);
			}
		},
		onSuccess: (data, { postId }) => {
			if (userId == null) return;
			if (data.hidden) {
				markHidden(userId, postId);
			} else {
				clearHidden(userId, postId);
				clearHiddenOverlay(postId);
				void queryClient.invalidateQueries({ queryKey: postsQueryKey });
				void queryClient.invalidateQueries({
					queryKey: followingPostsQueryKey,
				});
			}
		},
	});
}
