import useAuthStore from "../store/useAuthStore";

/**
 * 로그인 필수 액션 가드.
 * 비로그인 시 안내 후 false를 반환한다.
 */
export default function useRequireAuth() {
	const accessToken = useAuthStore((s) => s.accessToken);

	const requireAuth = (onAuthed?: () => void): boolean => {
		if (accessToken) {
			onAuthed?.();
			return true;
		}
		window.alert(
			"로그인이 필요합니다.\n우측 하단 DEV 로그인 패널에서 로그인해 주세요.",
		);
		return false;
	};

	return { isAuthenticated: !!accessToken, requireAuth };
}
