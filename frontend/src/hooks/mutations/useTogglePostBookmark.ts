import { useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookmarkPost, unbookmarkPost } from "../../services/communityApi";
import {
	patchPostInCache,
	removePostFromBookmarkCache,
} from "../../utils/communityCache";
import {
	flushToggleCommits,
	isRateLimited,
	scheduleToggleCommit,
} from "../../utils/toggleCommitQueue";
import { bookmarkedPostsQueryKey } from "../queries/useBookmarkedPosts";
import useCommunityStore from "../../store/useCommunityStore";
import { notifyActionError } from "../../utils/actionError";

const KEY_PREFIX = "post-bookmark:";

/**
 * PUT/DELETE /posts/{postSeq}/bookmark
 *
 * 좋아요와 같은 방식 — 아이콘은 즉시 바뀌고, 요청은 연타가 멈춘 뒤 한 번만 나간다.
 */
export default function useTogglePostBookmark() {
	const queryClient = useQueryClient();

	const { mutate, isPending } = useMutation({
		mutationFn: async ({
			postId,
			nextBookmarked,
		}: {
			postId: number;
			nextBookmarked: boolean;
		}) => (nextBookmarked ? bookmarkPost(postId) : unbookmarkPost(postId)),
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
		onError: (error, { postId, nextBookmarked }) => {
			useCommunityStore.getState().setBookmarked(postId, !nextBookmarked);
			patchPostInCache(queryClient, postId, { bookmarked: !nextBookmarked });
			void queryClient.invalidateQueries({ queryKey: bookmarkedPostsQueryKey });
			// 연타로 인한 429는 아이콘이 되돌아가는 것으로 충분
			if (isRateLimited(error)) return;
			notifyActionError(error, "북마크 처리에 실패했습니다.");
		},
	});

	// 화면을 벗어나기 전에 예약된 요청을 흘려보낸다
	useEffect(() => () => flushToggleCommits(KEY_PREFIX), []);

	const toggle = useCallback(
		(postId: number, currentBookmarked: boolean) => {
			const nextBookmarked = !currentBookmarked;
			useCommunityStore.getState().setBookmarked(postId, nextBookmarked);
			patchPostInCache(queryClient, postId, { bookmarked: nextBookmarked });
			if (!nextBookmarked) {
				removePostFromBookmarkCache(queryClient, postId);
			}
			scheduleToggleCommit({
				key: `${KEY_PREFIX}${postId}`,
				base: currentBookmarked,
				desired: nextBookmarked,
				commit: (desired) => mutate({ postId, nextBookmarked: desired }),
			});
		},
		[mutate, queryClient],
	);

	return { toggle, isPending };
}
