import { create } from "zustand";

/**
 * 로그인이 필요한 동작을 눌렀을 때 뜨는 안내 창의 열림 상태.
 *
 * useRequireAuth는 훅이라 화면을 그릴 수 없어서, 여기에 신호만 남기고 실제
 * 렌더링은 레이아웃에 한 번 올려 둔 LoginPromptHost가 맡는다(ToastHost와 같은 방식).
 */
type LoginPromptState = {
	isOpen: boolean;
	openLoginPrompt: () => void;
	closeLoginPrompt: () => void;
};

const useLoginPromptStore = create<LoginPromptState>()((set) => ({
	isOpen: false,
	openLoginPrompt: () => set({ isOpen: true }),
	closeLoginPrompt: () => set({ isOpen: false }),
}));

export default useLoginPromptStore;
