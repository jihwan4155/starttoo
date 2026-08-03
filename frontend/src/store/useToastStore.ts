import { create } from "zustand";

/**
 * 짧게 지나가는 안내 문구 한 줄.
 *
 * 동시에 여러 개를 쌓을 일이 없어 큐 없이 최신 문구 하나만 들고 있는다. 같은 문구를
 * 연달아 띄우는 경우에도 표시 시간이 다시 시작되도록 발행 번호(seq)를 함께 올린다.
 * 화면에서 지우는 시점은 ToastHost가 타이머로 관리한다.
 */
type ToastState = {
	message: string | null;
	/** 발행마다 증가 — 같은 문구여도 ToastHost가 새 알림으로 다룬다 */
	seq: number;
	showToast: (message: string) => void;
	hideToast: () => void;
};

const useToastStore = create<ToastState>()((set) => ({
	message: null,
	seq: 0,
	showToast: (message) => set((state) => ({ message, seq: state.seq + 1 })),
	hideToast: () => set({ message: null }),
}));

export default useToastStore;
