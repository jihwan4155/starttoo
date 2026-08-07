import { useQuery } from "@tanstack/react-query";
import { fetchArtistProfileByUserId } from "../../services/artistApi";

export const artistProfileByUserQueryKey = (userId: number) =>
	["artists", "byUser", userId] as const;

/**
 * 유저별 숍 프로필 — GET /artists 목록에서 해당 userId를 찾아온다.
 *
 * 인증(VERIFIED) 전에는 목록에 없어 null이 돌아온다.
 */
export default function useArtistProfile(userId: number, enabled: boolean) {
	return useQuery({
		queryKey: artistProfileByUserQueryKey(userId),
		queryFn: () => fetchArtistProfileByUserId(userId),
		enabled: enabled && userId > 0,
		staleTime: 5 * 60 * 1000,
	});
}
