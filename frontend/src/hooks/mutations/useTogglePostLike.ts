import { useMutation, useQueryClient } from "@tanstack/react-query";
import { likePost, unlikePost } from "../../services/communityApi";
import { patchPostInCache } from "../../utils/communityCache";
import useCommunityStore from "../../store/useCommunityStore";

type TogglePostLikeVariables = {
	postId: number;
	liked: boolean;
};

/** POST/DELETE /posts/{postId}/like */
export default function useTogglePostLike() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ postId, liked }: TogglePostLikeVariables) => {
			return liked ? unlikePost(postId) : likePost(postId);
		},
		onSuccess: (data) => {
			if (data?.postId == null) return;
			useCommunityStore.getState().setLiked(data.postId, data.liked);
			patchPostInCache(queryClient, data.postId, {
				liked: data.liked,
				...(data.likeCount != null ? { likeCount: data.likeCount } : {}),
			});
		},
	});
}
