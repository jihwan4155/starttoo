import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 커뮤니티 UI 로컬 상태.
 * - hiddenIds: 차단(숨김) 직후 UI
 * - liked/bookmarked: GET /posts 피드는 liked 미반영 → mutation·상세 조회 결과를 persist
 */
type CommunityState = {
	hiddenIds: Record<number, boolean>;
	liked: Record<number, boolean>;
	bookmarked: Record<number, boolean>;
	markHidden: (postId: number) => void;
	clearHidden: (postId: number) => void;
	setLiked: (postId: number, liked: boolean) => void;
	setBookmarked: (postId: number, bookmarked: boolean) => void;
	clearEngagement: () => void;
	clearAll: () => void;
};

const useCommunityStore = create<CommunityState>()(
	persist(
		(set) => ({
			hiddenIds: {},
			liked: {},
			bookmarked: {},
			markHidden: (postId) =>
				set((state) => ({
					hiddenIds: { ...state.hiddenIds, [postId]: true },
				})),
			clearHidden: (postId) =>
				set((state) => {
					const next = { ...state.hiddenIds };
					delete next[postId];
					return { hiddenIds: next };
				}),
			setLiked: (postId, liked) =>
				set((state) => ({
					liked: { ...state.liked, [postId]: liked },
				})),
			setBookmarked: (postId, bookmarked) =>
				set((state) => ({
					bookmarked: { ...state.bookmarked, [postId]: bookmarked },
				})),
			clearEngagement: () => set({ liked: {}, bookmarked: {} }),
			clearAll: () => set({ hiddenIds: {}, liked: {}, bookmarked: {} }),
		}),
		{
			name: "starttoo-community",
			version: 3,
			migrate: (persisted) => {
				const state = persisted as Partial<CommunityState>;
				return {
					hiddenIds: state.hiddenIds ?? {},
					liked: state.liked ?? {},
					bookmarked: state.bookmarked ?? {},
				};
			},
		},
	),
);

export default useCommunityStore;
