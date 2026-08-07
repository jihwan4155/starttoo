import { api } from "./api";
import type {
	BookmarkResponse,
	CommentLikeResponse,
	CommentResponse,
	CreateCommentRequest,
	CreatePostRequest,
	CursorPage,
	DwellRequest,
	FetchCommentsParams,
	FetchPostsParams,
	HiddenResponse,
	LikeResponse,
	PostResponse,
	ReportRequest,
	ReportResponse,
	StateResponse,
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

/** GET /posts/following — 팔로잉 피드 */
export async function fetchFollowingPosts(
	params?: FetchPostsParams,
): Promise<CursorPage<PostResponse>> {
	const { data } = await api.get<CursorPage<PostResponse>>("/posts/following", {
		params,
	});
	return data;
}

/** GET /posts/{postSeq} */
export async function fetchPost(postId: number): Promise<PostResponse> {
	const { data } = await api.get<PostResponse>(`/posts/${postId}`);
	return data;
}

/** POST /posts */
export async function createPost(
	body: CreatePostRequest,
): Promise<PostResponse> {
	const { data } = await api.post<PostResponse>("/posts", body);
	return data;
}

/** PATCH /posts/{postSeq} */
export async function updatePost(
	postId: number,
	body: UpdatePostRequest,
): Promise<PostResponse> {
	const { data } = await api.patch<PostResponse>(`/posts/${postId}`, body);
	return data;
}

/** DELETE /posts/{postSeq} */
export async function deletePost(postId: number): Promise<void> {
	await api.delete(`/posts/${postId}`);
}

/** PUT /posts/{postSeq}/like */
export async function likePost(postId: number): Promise<LikeResponse> {
	const { data } = await api.put<StateResponse>(`/posts/${postId}/like`);
	return { postId, liked: data.enabled };
}

/** DELETE /posts/{postSeq}/like */
export async function unlikePost(postId: number): Promise<LikeResponse> {
	const { data } = await api.delete<StateResponse>(`/posts/${postId}/like`);
	return { postId, liked: data.enabled };
}

/** PUT /posts/{postSeq}/bookmark */
export async function bookmarkPost(postId: number): Promise<BookmarkResponse> {
	const { data } = await api.put<StateResponse>(`/posts/${postId}/bookmark`);
	return { postId, bookmarked: data.enabled };
}

/** DELETE /posts/{postSeq}/bookmark */
export async function unbookmarkPost(
	postId: number,
): Promise<BookmarkResponse> {
	const { data } = await api.delete<StateResponse>(
		`/posts/${postId}/bookmark`,
	);
	return { postId, bookmarked: data.enabled };
}

/** PUT /posts/{postSeq}/not-interested */
export async function hidePost(postId: number): Promise<HiddenResponse> {
	const { data } = await api.put<StateResponse>(
		`/posts/${postId}/not-interested`,
	);
	return { postId, hidden: data.enabled };
}

/** DELETE /posts/{postSeq}/not-interested */
export async function unhidePost(postId: number): Promise<HiddenResponse> {
	const { data } = await api.delete<StateResponse>(
		`/posts/${postId}/not-interested`,
	);
	return { postId, hidden: data.enabled };
}

/**
 * POST /posts/{postSeq}/dwell — 피드 체류시간 점수 반영
 *
 * 초만 보내면 서버가 구간별 취향 점수로 환산한다. 원본 체류시간이나 사용자×피드
 * 통계 행은 서버에 남지 않고 주 스타일·색상 누적 점수만 즉시 갱신된다.
 */
export async function recordPostDwell(
	postId: number,
	seconds: number,
): Promise<void> {
	const body: DwellRequest = { seconds };
	await api.post(`/posts/${postId}/dwell`, body);
}

/** POST /posts/{postSeq}/reports */
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

/** GET /posts/me */
export async function fetchMyPosts(
	params?: FetchPostsParams,
): Promise<CursorPage<PostResponse>> {
	const { data } = await api.get<CursorPage<PostResponse>>("/posts/me", {
		params,
	});
	return data;
}

/** GET /users/{userSeq}/posts */
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

/** GET /posts/bookmarked */
export async function fetchBookmarkedPosts(
	params?: FetchPostsParams,
): Promise<CursorPage<PostResponse>> {
	const { data } = await api.get<CursorPage<PostResponse>>("/posts/bookmarked", {
		params,
	});
	return data;
}

/* ─── Comments ─── */

/** GET /posts/{postSeq}/comments */
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

/** POST /posts/{postSeq}/comments */
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

/** GET /comments/{commentSeq}/replies */
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

/** DELETE /comments/{commentSeq} */
export async function deleteComment(commentId: number): Promise<void> {
	await api.delete(`/comments/${commentId}`);
}

/** PUT /comments/{commentSeq}/like */
export async function likeComment(
	commentId: number,
): Promise<CommentLikeResponse> {
	const { data } = await api.put<StateResponse>(
		`/comments/${commentId}/like`,
	);
	return { commentId, liked: data.enabled };
}

/** DELETE /comments/{commentSeq}/like */
export async function unlikeComment(
	commentId: number,
): Promise<CommentLikeResponse> {
	const { data } = await api.delete<StateResponse>(
		`/comments/${commentId}/like`,
	);
	return { commentId, liked: data.enabled };
}
