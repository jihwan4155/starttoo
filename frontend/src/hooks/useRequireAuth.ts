import useAuthStore from "../store/useAuthStore";
import useLoginPromptStore from "../store/useLoginPromptStore";

/**
 * 로그인 필수 액션 가드.
 * 비로그인 시 안내 후 false를 반환한다 — 안내 창은 LoginPromptHost가 그린다.
 */
export default function useRequireAuth() {
	const accessToken = useAuthStore((s) => s.accessToken);
	const openLoginPrompt = useLoginPromptStore((s) => s.openLoginPrompt);

	const requireAuth = (onAuthed?: () => void): boolean => {
		if (accessToken) {
			onAuthed?.();
			return true;
		}
		openLoginPrompt();
		return false;
	};

	return { isAuthenticated: !!accessToken, requireAuth };
}
