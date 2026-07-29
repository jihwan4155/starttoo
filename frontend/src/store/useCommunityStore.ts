import { create } from "zustand";
import { persist } from "zustand/middleware";

/** userId별 숨김 게시글 ID */
export type HiddenIdsByUser = Record<number, Record<number, boolean>>;

const EMPTY_HIDDEN_IDS: Record<number, boolean> = {};

/**
 * 커뮤니티 UI 로컬 상태.
 * - hiddenIdsByUser: 회원별 숨김 persist — 로그아웃·새로고침 후에도 유지
 * - overlayHiddenIds: 현재 방문 중에만 오버레이 표시 (숨김 취소 가능)
 * - liked/bookmarked: GET /posts 피드는 liked 미반영 → mutation·상세 조회 결과를 persist
 */
type CommunityState = {
	hiddenIdsByUser: HiddenIdsByUser;
	overlayHiddenIds: Record<number, boolean>;
	liked: Record<number, boolean>;
	bookmarked: Record<number, boolean>;
	markHidden: (userId: number, postId: number) => void;
	clearHidden: (userId: number, postId: number) => void;
	markHiddenOverlay: (postId: number) => void;
	clearHiddenOverlay: (postId: number) => void;
	clearAllOverlays: () => void;
	setLiked: (postId: number, liked: boolean) => void;
	setBookmarked: (postId: number, bookmarked: boolean) => void;
	clearEngagement: () => void;
};

export function selectHiddenIdsForUser(
	hiddenIdsByUser: HiddenIdsByUser,
	userId: number | undefined,
): Record<number, boolean> {
	if (userId == null) return EMPTY_HIDDEN_IDS;
	return hiddenIdsByUser[userId] ?? EMPTY_HIDDEN_IDS;
}

const useCommunityStore = create<CommunityState>()(
	persist(
		(set) => ({
			hiddenIdsByUser: {},
			overlayHiddenIds: {},
			liked: {},
			bookmarked: {},
			markHidden: (userId, postId) =>
				set((state) => ({
					hiddenIdsByUser: {
						...state.hiddenIdsByUser,
						[userId]: {
							...(state.hiddenIdsByUser[userId] ?? {}),
							[postId]: true,
						},
					},
				})),
			clearHidden: (userId, postId) =>
				set((state) => {
					const current = state.hiddenIdsByUser[userId];
					if (!current) return state;
					const next = { ...current };
					delete next[postId];
					return {
						hiddenIdsByUser: {
							...state.hiddenIdsByUser,
							[userId]: next,
						},
					};
				}),
			markHiddenOverlay: (postId) =>
				set((state) => ({
					overlayHiddenIds: { ...state.overlayHiddenIds, [postId]: true },
				})),
			clearHiddenOverlay: (postId) =>
				set((state) => {
					const next = { ...state.overlayHiddenIds };
					delete next[postId];
					return { overlayHiddenIds: next };
				}),
			clearAllOverlays: () => set({ overlayHiddenIds: {} }),
			setLiked: (postId, liked) =>
				set((state) => ({
					liked: { ...state.liked, [postId]: liked },
				})),
			setBookmarked: (postId, bookmarked) =>
				set((state) => ({
					bookmarked: { ...state.bookmarked, [postId]: bookmarked },
				})),
			clearEngagement: () =>
				set({ overlayHiddenIds: {}, liked: {}, bookmarked: {} }),
		}),
		{
			name: "starttoo-community",
			version: 5,
			partialize: (state) => ({
				hiddenIdsByUser: state.hiddenIdsByUser,
				liked: state.liked,
				bookmarked: state.bookmarked,
			}),
			migrate: (persisted, version) => {
				const state = persisted as {
					hiddenIds?: Record<number, boolean>;
					hiddenIdsByUser?: HiddenIdsByUser;
					liked?: Record<number, boolean>;
					bookmarked?: Record<number, boolean>;
				};
				if (version < 5 && state.hiddenIds) {
					return {
						hiddenIdsByUser: { 0: state.hiddenIds },
						liked: state.liked ?? {},
						bookmarked: state.bookmarked ?? {},
					};
				}
				return {
					hiddenIdsByUser: state.hiddenIdsByUser ?? {},
					liked: state.liked ?? {},
					bookmarked: state.bookmarked ?? {},
				};
			},
		},
	),
);

export default useCommunityStore;
