import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
	CollectionPlacement,
	MannequinSkin,
	MannequinView,
} from "../types/collection";
import { isMannequinSkin, isMannequinView } from "../types/collection";
import { createDebouncedStorage } from "../utils/debouncedStorage";

type CollectionState = {
	byUser: Record<string, CollectionPlacement[]>;
	/** 편집 중 선택 (저장 전 임시) */
	editorSkin: MannequinSkin;
	/** 저장된 피부 톤 — 미리보기에 사용 */
	savedSkin: MannequinSkin;
	editorView: MannequinView;
	selectedPlacementId: string | null;
	isEditMode: boolean;
	lastSavedAt: string | null;
	setEditorSkin: (skin: MannequinSkin) => void;
	setEditorView: (view: MannequinView) => void;
	setSelectedPlacementId: (id: string | null) => void;
	enterEditMode: () => void;
	/** 서버 배치로 편집 버퍼를 덮어쓴다 (편집 진입·저장 완료 시) */
	setPlacements: (userId: number, placements: CollectionPlacement[]) => void;
	/** 편집 종료 — 서버 저장은 useSaveCollection이 담당한다 */
	saveCollection: () => void;
	addPlacement: (
		userId: number,
		placement: Omit<CollectionPlacement, "id">,
	) => string;
	updatePlacement: (
		userId: number,
		id: string,
		patch: Partial<
			Pick<
				CollectionPlacement,
				"x" | "y" | "scale" | "rotation" | "flipX" | "bodyPart"
			>
		>,
	) => void;
	removePlacement: (userId: number, id: string) => void;
	clearViewPlacements: (userId: number, view: MannequinView) => void;
};

function userKey(userId: number) {
	return String(userId);
}

function createPlacementId() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `placement-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeByUser(
	value: unknown,
): Record<string, CollectionPlacement[]> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	return value as Record<string, CollectionPlacement[]>;
}

const useCollectionStore = create<CollectionState>()(
	persist(
		(set) => ({
			byUser: {},
			editorSkin: "white",
			savedSkin: "white",
			editorView: "front",
			selectedPlacementId: null,
			isEditMode: false,
			lastSavedAt: null,

			setEditorSkin: (skin) => set({ editorSkin: skin }),
			setEditorView: (view) =>
				set({ editorView: view, selectedPlacementId: null }),
			setSelectedPlacementId: (id) => set({ selectedPlacementId: id }),
			enterEditMode: () =>
				set((state) => ({
					isEditMode: true,
					selectedPlacementId: null,
					editorSkin: state.savedSkin,
				})),
			setPlacements: (userId, placements) =>
				set((state) => ({
					selectedPlacementId: null,
					byUser: { ...state.byUser, [userKey(userId)]: placements },
				})),

			saveCollection: () =>
				set((state) => ({
					isEditMode: false,
					selectedPlacementId: null,
					savedSkin: state.editorSkin,
					lastSavedAt: new Date().toISOString(),
				})),

			addPlacement: (userId, placement) => {
				const id = createPlacementId();
				const key = userKey(userId);
				set((state) => ({
					selectedPlacementId: id,
					byUser: {
						...state.byUser,
						[key]: [...(state.byUser[key] ?? []), { ...placement, id }],
					},
				}));
				return id;
			},

			updatePlacement: (userId, id, patch) => {
				const key = userKey(userId);
				set((state) => ({
					byUser: {
						...state.byUser,
						[key]: (state.byUser[key] ?? []).map((p) =>
							p.id === id ? { ...p, ...patch } : p,
						),
					},
				}));
			},

			removePlacement: (userId, id) => {
				const key = userKey(userId);
				set((state) => ({
					selectedPlacementId:
						state.selectedPlacementId === id
							? null
							: state.selectedPlacementId,
					byUser: {
						...state.byUser,
						[key]: (state.byUser[key] ?? []).filter((p) => p.id !== id),
					},
				}));
			},

			clearViewPlacements: (userId, view) => {
				const key = userKey(userId);
				set((state) => ({
					selectedPlacementId: null,
					byUser: {
						...state.byUser,
						[key]: (state.byUser[key] ?? []).filter((p) => p.view !== view),
					},
				}));
			},
		}),
		{
			name: "starttoo-collection-placements",
			storage: createJSONStorage(() => createDebouncedStorage(400)),
			partialize: (state) => ({
				byUser: state.byUser,
				savedSkin: state.savedSkin,
				editorView: state.editorView,
				lastSavedAt: state.lastSavedAt,
			}),
			merge: (persisted, current) => {
				const saved =
					persisted && typeof persisted === "object"
						? (persisted as Partial<CollectionState>)
						: {};

				const mergedSkin = isMannequinSkin(saved.savedSkin)
					? saved.savedSkin
					: isMannequinSkin(saved.editorSkin)
						? saved.editorSkin
						: current.savedSkin;

				return {
					...current,
					...saved,
					byUser: normalizeByUser(saved.byUser),
					savedSkin: mergedSkin,
					editorSkin: mergedSkin,
					editorView: isMannequinView(saved.editorView)
						? saved.editorView
						: current.editorView,
					selectedPlacementId:
						typeof saved.selectedPlacementId === "string"
							? saved.selectedPlacementId
							: null,
					isEditMode: false,
					lastSavedAt:
						typeof saved.lastSavedAt === "string"
							? saved.lastSavedAt
							: null,
				};
			},
		},
	),
);

export default useCollectionStore;
