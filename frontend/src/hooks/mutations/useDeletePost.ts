import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deletePost } from "../../services/communityApi";
import { removePostFromCache } from "../../utils/communityCache";

/** DELETE /posts/{postId} */
export default function useDeletePost() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (postId: number) => deletePost(postId),
		onSuccess: (_data, postId) => {
			removePostFromCache(queryClient, postId);
		},
	});
}
