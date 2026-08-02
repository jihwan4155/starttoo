import { create } from "zustand";
import type { BodyScanResult } from "../components/simulation/useBodyScan";

export type SimulationHandoff = {
	/** 커버업에서 올린 신체 사진. blob URL은 페이지가 바뀌면 해제되므로 File로 넘긴다 */
	bodyPhoto: File;
	/** 선택한 추천 도안 이미지 URL */
	designUrl: string;
	/**
	 * 커버업에서 미리 끝내 둔 신체 스캔. 완료된 것만 넘긴다.
	 * 진행 중인 스캔은 커버업이 언마운트되면 더 갱신되지 않아 로딩에서 멈춘다.
	 */
	scan: BodyScanResult | null;
};

/**
 * 커버업 → 시뮬레이션 인계 데이터.
 *
 * <p>persist하지 않는다. File은 직렬화 대상이 아니고, 새로고침했다면 흐름을 처음부터
 * 다시 타는 편이 맞다. 시뮬레이션 페이지가 한 번 읽고 비운다.
 */
type SimulationHandoffState = {
	pending: SimulationHandoff | null;
	start: (handoff: SimulationHandoff) => void;
	/** 인계 데이터를 꺼내면서 비운다. 뒤로 갔다 다시 들어와도 재적용되지 않게 한다 */
	consume: () => SimulationHandoff | null;
};

const useSimulationHandoff = create<SimulationHandoffState>((set, get) => ({
	pending: null,
	start: (handoff) => set({ pending: handoff }),
	consume: () => {
		const { pending } = get();
		if (pending) set({ pending: null });
		return pending;
	},
}));

export default useSimulationHandoff;
