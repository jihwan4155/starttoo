import { useEffect } from "react";
import useMe from "./queries/useMe";
import useAuthStore from "../store/useAuthStore";
import useUserStore from "../store/useUserStore";

/**
 * 로그인 시 GET /users/me를 조회해 세션 사용자와 표시용 프로필을 채운다.
 *
 * 로그인·가입 응답에는 사용자 정보가 없으므로 여기서 useAuthStore.user를 세운다.
 * userId를 조건으로 켜지는 "내 것" 조회(내 피드·북마크·도안 보관함)가 이 동기화에
 * 매달려 있어서, MainLayout에서 한 번 실행한다.
 */
export default function useSyncMeProfile() {
	const accessToken = useAuthStore((s) => s.accessToken);
	const setUser = useAuthStore((s) => s.setUser);
	const syncFromMe = useUserStore((s) => s.syncFromMe);
	const clearProfile = useUserStore((s) => s.clearProfile);
	const query = useMe();
	const me = query.data;

	useEffect(() => {
		if (!accessToken) {
			clearProfile();
			return;
		}
		if (!me) return;
		setUser({
			userId: me.userId,
			nickname: me.nickname,
			role: me.role,
			accountStatus: me.accountStatus,
			profileImageUrl: me.profileImageUrl,
		});
		syncFromMe(me);
	}, [accessToken, me, setUser, syncFromMe, clearProfile]);

	return query;
}
