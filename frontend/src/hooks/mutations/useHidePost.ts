import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hidePost, unhidePost } from "../../services/communityApi";
import { postsQueryKey } from "../queries/usePosts";

type HidePostVariables = {
	postId: number;
	hidden: boolean;
};

/** POST/DELETE /posts/{postId}/hidden */
export default function useHidePost() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ postId, hidden }: HidePostVariables) => {
			return hidden ? unhidePost(postId) : hidePost(postId);
		},
		onSuccess: (data) => {
			if (!data.hidden) {
				void queryClient.invalidateQueries({ queryKey: postsQueryKey });
			}
		},
	});
}
