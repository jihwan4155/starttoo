import { create } from "zustand";

/**
 * DM 화면 선택 상태.
 *
 * 방 목록·메시지·안읽음 수는 모두 서버가 원본이라 react-query가 들고 있고,
 * 여기에는 "지금 어느 방을 보고 있는지"만 남긴다. 알림 목록에서 방을 열 때
 * (TopNav·useNotificationAction) 라우팅보다 먼저 선택을 넘겨야 해서 store가 필요하다.
 */
type DmState = {
	/** 현재 열려 있는 방 seq */
	activeRoomSeq: number | null;
	openRoom: (roomSeq: number) => void;
	/** DM 페이지를 벗어날 때 — 선택 해제 */
	leaveDm: () => void;
};

const useDmStore = create<DmState>((set) => ({
	activeRoomSeq: null,
	openRoom: (roomSeq) => set({ activeRoomSeq: roomSeq }),
	leaveDm: () => set({ activeRoomSeq: null }),
}));

export default useDmStore;
