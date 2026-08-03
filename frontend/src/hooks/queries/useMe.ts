import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../../services/userApi";
import useAuthStore from "../../store/useAuthStore";

export const meQueryKey = ["users", "me"] as const;

/**
 * GET /users/me
 *
 * accessToken만 있으면 켠다. 로그인·가입 응답에는 사용자 정보가 없어서
 * userId를 아는 유일한 경로가 이 호출이다 — userId를 조건으로 걸면
 * 영원히 켜지지 않는다. (계정별 캐시 분리는 로그아웃 시 queryClient.clear())
 */
export default function useMe() {
	const accessToken = useAuthStore((s) => s.accessToken);

	return useQuery({
		queryKey: meQueryKey,
		queryFn: fetchMe,
		enabled: Boolean(accessToken),
		staleTime: 60_000,
	});
}
