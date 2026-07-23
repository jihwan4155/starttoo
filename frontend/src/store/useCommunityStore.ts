import { create } from "zustand";
import type { PostComment } from "../types/community";

/**
 * 커뮤니티 좋아요·북마크·작성 댓글 상태 (피드 ↔ 상세 모달 동기화)
 * TODO: 백엔드 연동 시 API 뮤테이션 + 쿼리 무효화로 교체
 */
type CommunityState = {
	liked: Record<number, boolean>;
	bookmarked: Record<number, boolean>;
	/** 사용자가 이 세션에서 작성한 댓글 (게시글 id별) */
	extraComments: Record<number, PostComment[]>;
	toggleLike: (postId: number) => void;
	toggleBookmark: (postId: number) => void;
	addComment: (postId: number, content: string) => void;
};

const useCommunityStore = create<CommunityState>((set) => ({
	liked: {},
	bookmarked: {},
	extraComments: {},
	toggleLike: (postId) =>
		set((state) => ({
			liked: { ...state.liked, [postId]: !state.liked[postId] },
		})),
	toggleBookmark: (postId) =>
		set((state) => ({
			bookmarked: { ...state.bookmarked, [postId]: !state.bookmarked[postId] },
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
}));

export default useCommunityStore;
