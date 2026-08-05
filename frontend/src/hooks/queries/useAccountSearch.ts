import { useQuery } from "@tanstack/react-query";
import { searchAccounts, searchArtists } from "../../services/searchApi";
import { isSearchableQuery } from "../../types/search";

export const accountSearchQueryKey = ["search", "accounts"] as const;

type AccountSearchOptions = {
	/** true면 인증 아티스트 인덱스만 검색한다 */
	artistsOnly?: boolean;
	size?: number;
};

/**
 * 닉네임 검색 — 한 글자부터 본 검색을 쓴다.
 *
 * 예전에는 서버가 본 검색을 두 글자 이상으로 막아서 한 글자일 때만 자동완성
 * 엔드포인트로 갈아 끼웠다. 서버가 한 글자를 받게 되면서(BE a8a2020) 그 분기가
 * 필요 없어졌다 — 길이와 무관하게 같은 엔드포인트를 쓰므로 결과 모양도 하나다.
 *
 * 공백·특수문자가 섞인 입력은 서버 @Pattern에 걸려 400이 되므로 요청 자체를
 * 보내지 않는다.
 */
export default function useAccountSearch(
	query: string,
	{ artistsOnly = false, size }: AccountSearchOptions = {},
) {
	const trimmed = query.trim();
	const isValid = trimmed.length > 0 && isSearchableQuery(trimmed);

	return useQuery({
		queryKey: [...accountSearchQueryKey, { q: trimmed, artistsOnly, size }],
		enabled: isValid,
		queryFn: () =>
			artistsOnly
				? searchArtists(trimmed, size ?? 20)
				: searchAccounts(trimmed, size ?? 20),
		// 같은 검색어를 다시 치는 일이 흔해 잠깐 캐시해 둔다.
		staleTime: 30_000,
	});
}
