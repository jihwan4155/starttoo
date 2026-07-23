import { create } from "zustand";

/**
 * DM 읽음 상태 (사이드 네비 뱃지 ↔ DM 페이지 동기화)
 * TODO: 백엔드 연동 시 안읽음 수는 API(GET /dm/rooms)로 대체
 */
type DmState = {
	readRoomIds: number[];
	markRead: (roomId: number) => void;
};

const useDmStore = create<DmState>((set) => ({
	readRoomIds: [],
	markRead: (roomId) =>
		set((state) =>
			state.readRoomIds.includes(roomId)
				? state
				: { readRoomIds: [...state.readRoomIds, roomId] },
		),
}));

export default useDmStore;
