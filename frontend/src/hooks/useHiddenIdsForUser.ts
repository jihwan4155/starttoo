import useAuthStore from "../store/useAuthStore";
import useCommunityStore, {
	selectHiddenIdsForUser,
} from "../store/useCommunityStore";

/** 현재 로그인 회원의 숨김 피드 ID 맵 */
export default function useHiddenIdsForUser() {
	const userId = useAuthStore((s) => s.user?.userId);
	return useCommunityStore((s) =>
		selectHiddenIdsForUser(s.hiddenIdsByUser, userId),
	);
}
