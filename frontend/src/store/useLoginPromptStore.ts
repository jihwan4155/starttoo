import { create } from "zustand";

/**
 * 로그인이 필요한 동작을 눌렀을 때 뜨는 안내 창의 열림 상태.
 *
 * useRequireAuth는 훅이라 화면을 그릴 수 없어서, 여기에 신호만 남기고 실제
 * 렌더링은 레이아웃에 한 번 올려 둔 LoginPromptHost가 맡는다(ToastHost와 같은 방식).
 */
type LoginPromptState = {
	isOpen: boolean;
	/**
	 * 로그인 뒤 돌아갈 곳. 비워 두면 안내를 띄운 화면으로 돌아온다.
	 *
	 * 로그인 필요 페이지로 직접 들어온 경우에만 채운다 — 그 페이지는 보여 줄 수
	 * 없어 홈으로 옮긴 뒤 안내를 띄우므로, 돌아갈 곳이 지금 화면(홈)과 다르다.
	 */
	redirectTo: string | null;
	openLoginPrompt: (redirectTo?: string) => void;
	closeLoginPrompt: () => void;
};

const useLoginPromptStore = create<LoginPromptState>()((set) => ({
	isOpen: false,
	redirectTo: null,
	openLoginPrompt: (redirectTo) =>
		set({ isOpen: true, redirectTo: redirectTo ?? null }),
	closeLoginPrompt: () => set({ isOpen: false }),
}));

export default useLoginPromptStore;
