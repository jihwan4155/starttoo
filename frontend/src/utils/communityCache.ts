import type { QueryClient } from "@tanstack/react-query";
import { postQueryKey } from "../hooks/queries/usePost";
import { postsQueryKey } from "../hooks/queries/usePosts";
import { followingPostsQueryKey } from "../hooks/queries/useFollowingPosts";
import { bookmarkedPostsQueryKey } from "../hooks/queries/useBookmarkedPosts";
import { commentsQueryKey } from "../hooks/queries/useComments";
import { commentRepliesQueryKey } from "../hooks/queries/useCommentReplies";
import type { Post, PostComment } from "../types/community";

type PostsInfiniteData = {
	pages: Array<{
		items: Post[];
		nextCursor: string | null;
		hasNext: boolean;
	}>;
	pageParams: unknown[];
};

type CommentsData = {
	items: PostComment[];
	nextCursor: string | null;
	hasNext: boolean;
};

/** 무한 스크롤 피드·단건 캐시의 게시글을 updater로 동시에 갱신 */
export function updatePostInCache(
	queryClient: QueryClient,
	postId: number,
	updater: (post: Post) => Post,
) {
	queryClient.setQueriesData<PostsInfiniteData>(
		{ queryKey: postsQueryKey },
		(old) => {
			if (!old || !Array.isArray(old.pages)) return old;
			return {
				...old,
				pages: old.pages.map((page) => ({
					...page,
					items: page.items.map((post) =>
						post.id === postId ? updater(post) : post,
					),
				})),
			};
		},
	);
	queryClient.setQueryData<Post>(postQueryKey(postId), (old) =>
		old ? updater(old) : old,
	);
}

/** 무한 스크롤 피드·단건 캐시의 게시글 필드를 동시에 갱신 */
export function patchPostInCache(
	queryClient: QueryClient,
	postId: number,
	patch: Partial<Post>,
) {
	updatePostInCache(queryClient, postId, (post) => ({ ...post, ...patch }));
}

/** 좋아요 낙관적 갱신 — liked 플래그와 likeCount를 함께 조정 */
export function bumpPostLikeInCache(
	queryClient: QueryClient,
	postId: number,
	liked: boolean,
	delta: number,
) {
	updatePostInCache(queryClient, postId, (post) => ({
		...post,
		liked,
		likeCount: Math.max(0, (post.likeCount ?? 0) + delta),
	}));
}

/** 삭제·숨김 후 피드 캐시에서 게시글 제거 */
export function removePostFromCache(
	queryClient: QueryClient,
	postId: number,
) {
	queryClient.setQueriesData<PostsInfiniteData>(
		{ queryKey: postsQueryKey },
		(old) => {
			if (!old || !Array.isArray(old.pages)) return old;
			return {
				...old,
				pages: old.pages.map((page) => ({
					...page,
					items: page.items.filter((post) => post.id !== postId),
				})),
			};
		},
	);
	queryClient.removeQueries({ queryKey: postQueryKey(postId) });
	queryClient.setQueriesData<PostsInfiniteData>(
		{ queryKey: followingPostsQueryKey },
		(old) => {
			if (!old || !Array.isArray(old.pages)) return old;
			return {
				...old,
				pages: old.pages.map((page) => ({
					...page,
					items: page.items.filter((post) => post.id !== postId),
				})),
			};
		},
	);
}

/** 북마크 해제 후 북마크 목록 캐시에서 게시글 제거 */
export function removePostFromBookmarkCache(
	queryClient: QueryClient,
	postId: number,
) {
	queryClient.setQueriesData<PostsInfiniteData>(
		{ queryKey: bookmarkedPostsQueryKey },
		(old) => {
			if (!old || !Array.isArray(old.pages)) return old;
			return {
				...old,
				pages: old.pages.map((page) => ({
					...page,
					items: page.items.filter((post) => post.id !== postId),
				})),
			};
		},
	);
}

/** 댓글 목록 캐시의 특정 댓글을 updater로 갱신 (루트 댓글) */
export function updateCommentInCache(
	queryClient: QueryClient,
	postId: number,
	commentId: number,
	updater: (comment: PostComment) => PostComment,
) {
	queryClient.setQueriesData<CommentsData>(
		{ queryKey: commentsQueryKey(postId) },
		(old) => {
			if (!old || !Array.isArray(old.items)) return old;
			return {
				...old,
				items: old.items.map((comment) =>
					comment.id === commentId ? updater(comment) : comment,
				),
			};
		},
	);
}

/** 답글 목록 캐시의 특정 답글을 updater로 갱신 */
export function updateReplyInCache(
	queryClient: QueryClient,
	rootCommentId: number,
	replyId: number,
	updater: (reply: PostComment) => PostComment,
) {
	queryClient.setQueriesData<CommentsData>(
		{ queryKey: commentRepliesQueryKey(rootCommentId) },
		(old) => {
			if (!old || !Array.isArray(old.items)) return old;
			return {
				...old,
				items: old.items.map((reply) =>
					reply.id === replyId ? updater(reply) : reply,
				),
			};
		},
	);
}

/** 댓글 목록 캐시의 특정 댓글 필드 갱신 (루트 댓글) */
export function patchCommentInCache(
	queryClient: QueryClient,
	postId: number,
	commentId: number,
	patch: Partial<PostComment>,
) {
	updateCommentInCache(queryClient, postId, commentId, (comment) => ({
		...comment,
		...patch,
	}));
}

/** 답글 목록 캐시의 특정 답글 필드 갱신 */
export function patchReplyInCache(
	queryClient: QueryClient,
	rootCommentId: number,
	replyId: number,
	patch: Partial<PostComment>,
) {
	updateReplyInCache(queryClient, rootCommentId, replyId, (reply) => ({
		...reply,
		...patch,
	}));
}

/** 댓글 좋아요 낙관적 갱신 — liked 플래그와 likeCount를 함께 조정 */
export function bumpCommentLikeInCache(
	queryClient: QueryClient,
	{
		postId,
		commentId,
		rootCommentId,
		liked,
		delta,
	}: {
		postId: number;
		commentId: number;
		/** 답글일 때 최상위 댓글 ID */
		rootCommentId?: number;
		liked: boolean;
		delta: number;
	},
) {
	const bump = (comment: PostComment): PostComment => ({
		...comment,
		liked,
		likeCount: Math.max(0, (comment.likeCount ?? 0) + delta),
	});
	updateCommentInCache(queryClient, postId, commentId, bump);
	if (rootCommentId != null) {
		updateReplyInCache(queryClient, rootCommentId, commentId, bump);
	}
}

/** 답글 작성 후 GET /comments/{rootId}/replies 캐시에 추가 (오래된 순) */
export function appendReplyToCache(
	queryClient: QueryClient,
	rootCommentId: number,
	reply: PostComment,
) {
	queryClient.setQueriesData<CommentsData>(
		{ queryKey: commentRepliesQueryKey(rootCommentId) },
		(old) => {
			if (!old || !Array.isArray(old.items)) {
				return {
					items: [reply],
					nextCursor: null,
					hasNext: false,
				};
			}
			return { ...old, items: [...old.items, reply] };
		},
	);
}

/** 루트 댓글의 replyCount 증가 */
export function bumpRootCommentReplyCount(
	queryClient: QueryClient,
	postId: number,
	rootCommentId: number,
) {
	queryClient.setQueriesData<CommentsData>(
		{ queryKey: commentsQueryKey(postId) },
		(old) => {
			if (!old || !Array.isArray(old.items)) return old;
			return {
				...old,
				items: old.items.map((comment) =>
					comment.id === rootCommentId
						? {
								...comment,
								replyCount: (comment.replyCount ?? 0) + 1,
							}
						: comment,
				),
			};
		},
	);
}

/** 루트 댓글 삭제 후 목록 캐시에서 제거 */
export function removeCommentFromCache(
	queryClient: QueryClient,
	postId: number,
	commentId: number,
) {
	queryClient.setQueriesData<CommentsData>(
		{ queryKey: commentsQueryKey(postId) },
		(old) => {
			if (!old || !Array.isArray(old.items)) return old;
			return {
				...old,
				items: old.items.filter((comment) => comment.id !== commentId),
			};
		},
	);
}

/** 답글 삭제 후 답글 목록 캐시에서 제거 */
export function removeReplyFromCache(
	queryClient: QueryClient,
	rootCommentId: number,
	replyId: number,
) {
	queryClient.setQueriesData<CommentsData>(
		{ queryKey: commentRepliesQueryKey(rootCommentId) },
		(old) => {
			if (!old || !Array.isArray(old.items)) return old;
			return {
				...old,
				items: old.items.filter((reply) => reply.id !== replyId),
			};
		},
	);
}
