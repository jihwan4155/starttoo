import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Post, PostComment } from "../types/community";
import useUserStore from "./useUserStore";

/**
 * 커뮤니티 좋아요·북마크·작성 댓글·작성 게시물 상태 (피드 ↔ 상세 모달 동기화)
 * persist로 localStorage에 저장되어 새로고침해도 유지된다.
 * TODO: 백엔드 연동 시 API 뮤테이션 + 쿼리 무효화로 교체
 */
type CommunityState = {
	liked: Record<number, boolean>;
	bookmarked: Record<number, boolean>;
	/** 댓글 좋아요 (댓글 id별) */
	commentLiked: Record<number, boolean>;
	/** 사용자가 이 세션에서 작성한 댓글 (게시글 id별) */
	extraComments: Record<number, PostComment[]>;
	/** 사용자가 이 세션에서 올린 게시물 (피드 맨 위에 노출) */
	myPosts: Post[];
	toggleLike: (postId: number) => void;
	toggleBookmark: (postId: number) => void;
	toggleCommentLike: (commentId: number) => void;
	addComment: (postId: number, content: string) => void;
	addPost: (imageUrl: string, caption: string) => void;
};

const useCommunityStore = create<CommunityState>()(
	persist(
		(set) => ({
			liked: {},
			bookmarked: {},
			commentLiked: {},
			extraComments: {},
			myPosts: [],
			toggleLike: (postId) =>
				set((state) => ({
					liked: { ...state.liked, [postId]: !state.liked[postId] },
				})),
			toggleBookmark: (postId) =>
				set((state) => ({
					bookmarked: {
						...state.bookmarked,
						[postId]: !state.bookmarked[postId],
					},
				})),
			// TODO: 댓글 좋아요 API 연동
			toggleCommentLike: (commentId) =>
				set((state) => ({
					commentLiked: {
						...state.commentLiked,
						[commentId]: !state.commentLiked[commentId],
					},
				})),
			addComment: (postId, content) =>
				set((state) => ({
					extraComments: {
						...state.extraComments,
						[postId]: [
							...(state.extraComments[postId] ?? []),
							{
								id: Date.now(),
								author: { nickname: "나", isArtist: false },
								content,
								createdAt: new Date().toISOString(),
								likeCount: 0,
							},
						],
					},
				})),
			// TODO: 게시물 작성 API(POST /posts) 연동
			addPost: (imageUrl, caption) =>
				set((state) => ({
					myPosts: [
						{
							id: Date.now(),
							author: {
								nickname: useUserStore.getState().nickname,
								isArtist: false,
							},
							createdAt: new Date().toISOString(),
							imageUrl,
							caption,
							likeCount: 0,
							commentCount: 0,
							comments: [],
						},
						...state.myPosts,
					],
				})),
		}),
		{
			name: "starttoo-community",
			version: 1,
			// v0(timeAgo 문자열) → v1(createdAt ISO) 이관 — id가 Date.now()라 작성 시각으로 복원
			migrate: (persisted) => {
				const state = persisted as CommunityState;
				const toCreatedAt = <T extends { id: number; createdAt?: string }>(
					item: T,
				) => ({
					...item,
					createdAt: item.createdAt ?? new Date(item.id).toISOString(),
				});
				return {
					...state,
					commentLiked: state.commentLiked ?? {},
					extraComments: Object.fromEntries(
						Object.entries(state.extraComments ?? {}).map(
							([postId, comments]) => [postId, comments.map(toCreatedAt)],
						),
					),
					myPosts: (state.myPosts ?? []).map(toCreatedAt),
				};
			},
		},
	),
);

export default useCommunityStore;
