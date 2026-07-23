import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DesignExtractResult, SavedDesign } from "../types/designExtract";

/**
 * 내 도안 보관함 상태 (도안 추출 결과 저장 ↔ 마이페이지 동기화)
 * persist로 localStorage에 저장되어 새로고침해도 유지된다.
 * TODO: 백엔드 연동 시 POST/GET/DELETE /designs API로 교체
 */
type DesignState = {
	savedDesigns: SavedDesign[];
	addDesign: (design: DesignExtractResult) => void;
	removeDesign: (designId: number) => void;
};

const useDesignStore = create<DesignState>()(
	persist(
		(set) => ({
			savedDesigns: [],
			addDesign: (design) =>
				set((state) => {
					// 같은 도안(previewUrl 기준) 중복 저장 방지
					if (state.savedDesigns.some((d) => d.previewUrl === design.previewUrl)) {
						return state;
					}
					return {
						savedDesigns: [
							{
								...design,
								id: Date.now(),
								createdAt: new Date().toISOString(),
							},
							...state.savedDesigns,
						],
					};
				}),
			removeDesign: (designId) =>
				set((state) => ({
					savedDesigns: state.savedDesigns.filter((d) => d.id !== designId),
				})),
		}),
		{ name: "starttoo-designs" },
	),
);

export default useDesignStore;
