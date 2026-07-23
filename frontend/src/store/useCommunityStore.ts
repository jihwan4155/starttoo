import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Post, PostComment } from "../types/community";

/**
 * 커뮤니티 좋아요·북마크·작성 댓글·작성 게시물 상태 (피드 ↔ 상세 모달 동기화)
 * persist로 localStorage에 저장되어 새로고침해도 유지된다.
 * TODO: 백엔드 연동 시 API 뮤테이션 + 쿼리 무효화로 교체
 */
type CommunityState = {
	liked: Record<number, boolean>;
	bookmarked: Record<number, boolean>;
	/** 사용자가 이 세션에서 작성한 댓글 (게시글 id별) */
	extraComments: Record<number, PostComment[]>;
	/** 사용자가 이 세션에서 올린 게시물 (피드 맨 위에 노출) */
	myPosts: Post[];
	toggleLike: (postId: number) => void;
	toggleBookmark: (postId: number) => void;
	addComment: (postId: number, content: string) => void;
	addPost: (imageUrl: string, caption: string) => void;
};

const useCommunityStore = create<CommunityState>()(
	persist(
		(set) => ({
			liked: {},
			bookmarked: {},
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
								timeAgo: "방금 전",
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
							author: { nickname: "스누피", isArtist: false },
							timeAgo: "방금 전",
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
		{ name: "starttoo-community" }
	)
);

export default useCommunityStore;
