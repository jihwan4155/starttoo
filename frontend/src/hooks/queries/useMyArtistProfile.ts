import { useQuery } from "@tanstack/react-query";
import { fetchMyArtistProfile } from "../../services/artistApi";

export const myArtistProfileQueryKey = ["artists", "me"] as const;

/**
 * 내 숍 프로필 — GET /artists 목록에서 나를 찾아온다.
 *
 * 인증(VERIFIED) 전에는 목록에 없어 null이 돌아온다. 그때 화면은 GET /users/me가
 * 주는 매장명·인증 상태만 보여준다.
 *
 * 키에 userId를 넣지 않는다 — "내 것"이라 계정마다 갈릴 일이 없고, 로그아웃 때
 * clearSession이 캐시를 비운다. useUpdateArtist가 이 키로 응답을 꽂아 넣는다.
 */
export default function useMyArtistProfile(userId: number, enabled: boolean) {
	return useQuery({
		queryKey: myArtistProfileQueryKey,
		queryFn: () => fetchMyArtistProfile(userId),
		enabled: enabled && userId > 0,
		staleTime: 5 * 60 * 1000,
	});
}
