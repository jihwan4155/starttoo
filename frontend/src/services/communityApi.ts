import { api } from "./api";
import type {
	BookmarkResponse,
	CommentLikeResponse,
	CommentResponse,
	CreateCommentRequest,
	CreatePostRequest,
	CursorPage,
	FetchCommentsParams,
	FetchPostsParams,
	HiddenResponse,
	LikeResponse,
	PostResponse,
	ReportRequest,
	ReportResponse,
	UpdatePostRequest,
} from "../types/community";

/* ─── Posts ─── */

/** GET /posts — 공개 전체 피드 */
export async function fetchPosts(
	params?: FetchPostsParams,
): Promise<CursorPage<PostResponse>> {
	const { data } = await api.get<CursorPage<PostResponse>>("/posts", {
		params,
	});
	return data;
}

/** GET /posts/following — 팔로잉 피드 (Bearer 필요) */
export async function fetchFollowingPosts(
	params?: FetchPostsParams,
): Promise<CursorPage<PostResponse>> {
	const { data } = await api.get<CursorPage<PostResponse>>(
		"/posts/following",
		{ params },
	);
	return data;
}

/** GET /posts/{postId} */
export async function fetchPost(postId: number): Promise<PostResponse> {
	const { data } = await api.get<PostResponse>(`/posts/${postId}`);
	return data;
}

/** POST /posts (Bearer 필요) */
export async function createPost(
	body: CreatePostRequest,
): Promise<PostResponse> {
	const { data } = await api.post<PostResponse>("/posts", body);
	return data;
}

/** PATCH /posts/{postId} (Bearer 필요) */
export async function updatePost(
	postId: number,
	body: UpdatePostRequest,
): Promise<PostResponse> {
	const { data } = await api.patch<PostResponse>(`/posts/${postId}`, body);
	return data;
}

/** DELETE /posts/{postId} (Bearer 필요) */
export async function deletePost(postId: number): Promise<void> {
	await api.delete(`/posts/${postId}`);
}

/** POST /posts/{postId}/like */
export async function likePost(postId: number): Promise<LikeResponse> {
	const { data } = await api.post<LikeResponse>(`/posts/${postId}/like`);
	return data;
}

/** DELETE /posts/{postId}/like */
export async function unlikePost(postId: number): Promise<LikeResponse> {
	const { data } = await api.delete<LikeResponse>(`/posts/${postId}/like`);
	return data;
}

/** POST /posts/{postId}/bookmark */
export async function bookmarkPost(postId: number): Promise<BookmarkResponse> {
	const { data } = await api.post<BookmarkResponse>(
		`/posts/${postId}/bookmark`,
	);
	return data;
}

/** DELETE /posts/{postId}/bookmark */
export async function unbookmarkPost(
	postId: number,
): Promise<BookmarkResponse> {
	const { data } = await api.delete<BookmarkResponse>(
		`/posts/${postId}/bookmark`,
	);
	return data;
}

/** POST /posts/{postId}/hidden */
export async function hidePost(postId: number): Promise<HiddenResponse> {
	const { data } = await api.post<HiddenResponse>(`/posts/${postId}/hidden`);
	return data;
}

/** DELETE /posts/{postId}/hidden */
export async function unhidePost(postId: number): Promise<HiddenResponse> {
	const { data } = await api.delete<HiddenResponse>(
		`/posts/${postId}/hidden`,
	);
	return data;
}

/** POST /posts/{postId}/reports */
export async function reportPost(
	postId: number,
	body: ReportRequest,
): Promise<ReportResponse> {
	const { data } = await api.post<ReportResponse>(
		`/posts/${postId}/reports`,
		body,
	);
	return data;
}

/** GET /users/me/posts */
export async function fetchMyPosts(
	params?: FetchPostsParams & { status?: string },
): Promise<CursorPage<PostResponse>> {
	const { data } = await api.get<CursorPage<PostResponse>>("/users/me/posts", {
		params,
	});
	return data;
}

/** GET /users/{userId}/posts */
export async function fetchUserPosts(
	userId: number,
	params?: FetchPostsParams,
): Promise<CursorPage<PostResponse>> {
	const { data } = await api.get<CursorPage<PostResponse>>(
		`/users/${userId}/posts`,
		{ params },
	);
	return data;
}

/** GET /users/me/bookmarked-posts */
export async function fetchBookmarkedPosts(
	params?: FetchPostsParams,
): Promise<CursorPage<PostResponse>> {
	const { data } = await api.get<CursorPage<PostResponse>>(
		"/users/me/bookmarked-posts",
		{ params },
	);
	return data;
}

/* ─── Comments ─── */

/** GET /posts/{postId}/comments */
export async function fetchComments(
	postId: number,
	params?: FetchCommentsParams,
): Promise<CursorPage<CommentResponse>> {
	const { data } = await api.get<CursorPage<CommentResponse>>(
		`/posts/${postId}/comments`,
		{ params },
	);
	return data;
}

/** POST /posts/{postId}/comments (Bearer 필요) */
export async function createComment(
	postId: number,
	body: CreateCommentRequest,
): Promise<CommentResponse> {
	const { data } = await api.post<CommentResponse>(
		`/posts/${postId}/comments`,
		body,
	);
	return data;
}

/** GET /comments/{commentId}/replies */
export async function fetchReplies(
	commentId: number,
	params?: FetchCommentsParams,
): Promise<CursorPage<CommentResponse>> {
	const { data } = await api.get<CursorPage<CommentResponse>>(
		`/comments/${commentId}/replies`,
		{ params },
	);
	return data;
}

/** DELETE /comments/{commentId} (Bearer 필요) */
export async function deleteComment(commentId: number): Promise<void> {
	await api.delete(`/comments/${commentId}`);
}

/** POST /comments/{commentId}/like */
export async function likeComment(
	commentId: number,
): Promise<CommentLikeResponse> {
	const { data } = await api.post<CommentLikeResponse>(
		`/comments/${commentId}/like`,
	);
	return data;
}

/** DELETE /comments/{commentId}/like */
export async function unlikeComment(
	commentId: number,
): Promise<CommentLikeResponse> {
	const { data } = await api.delete<CommentLikeResponse>(
		`/comments/${commentId}/like`,
	);
	return data;
}
