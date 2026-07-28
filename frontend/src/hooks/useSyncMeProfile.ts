import { useEffect } from "react";
import useMe from "./queries/useMe";
import useAuthStore from "../store/useAuthStore";
import useUserStore from "../store/useUserStore";

/**
 * 로그인 시 GET /users/me를 조회하고 useUserStore(TopNav·마이페이지 등)에 동기화한다.
 */
export default function useSyncMeProfile() {
	const accessToken = useAuthStore((s) => s.accessToken);
	const syncFromMe = useUserStore((s) => s.syncFromMe);
	const clearProfile = useUserStore((s) => s.clearProfile);
	const query = useMe();

	useEffect(() => {
		if (!accessToken) {
			clearProfile();
			return;
		}
		if (query.data) syncFromMe(query.data);
	}, [accessToken, query.data, syncFromMe, clearProfile]);

	return query;
}
