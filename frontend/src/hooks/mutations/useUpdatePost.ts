import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_POST_TYPE } from "../../constants/community";
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
	retainedPostImageIds: number[];
};

/** PATCH /posts/{postId} — 캡션·기존 이미지 유지 수정 */
export default function useUpdatePost() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			postId,
			caption,
			retainedPostImageIds,
		}: UpdatePostVariables) => {
			const trimmed = caption.trim();
			const response = await updatePost(postId, {
				postType: DEFAULT_POST_TYPE,
				content: trimmed || null,
				retainedPostImageIds,
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
