import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postsQueryKey } from "../queries/usePosts";
import { followingPostsQueryKey } from "../queries/useFollowingPosts";
import { myPostsQueryKey } from "../queries/useMyPosts";
import { updatePost } from "../../services/communityApi";
import type { Post } from "../../types/community";
import { patchPostInCache } from "../../utils/communityCache";
import { mapPostResponse } from "../../utils/mapPost";

type UpdatePostVariables = {
	postId: number;
	caption: string;
};

/** PATCH /posts/{postSeq} — 본문 수정 */
export default function useUpdatePost() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ postId, caption }: UpdatePostVariables) => {
			const trimmed = caption.trim();
			const response = await updatePost(postId, {
				content: trimmed || null,
			});
			return mapPostResponse(response);
		},
		onSuccess: (post: Post) => {
			patchPostInCache(queryClient, post.id, post);
			void queryClient.invalidateQueries({ queryKey: postsQueryKey });
			void queryClient.invalidateQueries({ queryKey: followingPostsQueryKey });
			void queryClient.invalidateQueries({ queryKey: myPostsQueryKey });
		},
	});
}
