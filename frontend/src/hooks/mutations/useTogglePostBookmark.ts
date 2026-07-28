import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookmarkPost, unbookmarkPost } from "../../services/communityApi";
import {
	patchPostInCache,
	removePostFromBookmarkCache,
} from "../../utils/communityCache";
import { bookmarkedPostsQueryKey } from "../queries/useBookmarkedPosts";
import useCommunityStore from "../../store/useCommunityStore";

type TogglePostBookmarkVariables = {
	postId: number;
	bookmarked: boolean;
};

/** POST/DELETE /posts/{postId}/bookmark */
export default function useTogglePostBookmark() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ postId, bookmarked }: TogglePostBookmarkVariables) => {
			return bookmarked ? unbookmarkPost(postId) : bookmarkPost(postId);
		},
		onMutate: ({ postId, bookmarked }) => {
			const nextBookmarked = !bookmarked;
			useCommunityStore.getState().setBookmarked(postId, nextBookmarked);
			patchPostInCache(queryClient, postId, { bookmarked: nextBookmarked });
			if (bookmarked) {
				removePostFromBookmarkCache(queryClient, postId);
			}
		},
		onSuccess: (data) => {
			if (data?.postId == null) return;
			useCommunityStore.getState().setBookmarked(data.postId, data.bookmarked);
			patchPostInCache(queryClient, data.postId, {
				bookmarked: data.bookmarked,
			});
			if (!data.bookmarked) {
				removePostFromBookmarkCache(queryClient, data.postId);
			}
		},
		onError: (_err, { postId, bookmarked }) => {
			useCommunityStore.getState().setBookmarked(postId, bookmarked);
			patchPostInCache(queryClient, postId, { bookmarked });
			void queryClient.invalidateQueries({ queryKey: bookmarkedPostsQueryKey });
		},
	});
}
