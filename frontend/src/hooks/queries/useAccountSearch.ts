import { useQuery } from "@tanstack/react-query";
import {
	autocompleteAccounts,
	autocompleteArtists,
	searchAccounts,
	searchArtists,
} from "../../services/searchApi";
import { isSearchableQuery } from "../../types/search";

export const accountSearchQueryKey = ["search", "accounts"] as const;

type AccountSearchOptions = {
	/** true면 인증 아티스트 인덱스만 검색한다 */
	artistsOnly?: boolean;
	size?: number;
};

/**
 * 닉네임 검색 — 한 글자면 자동완성, 두 글자 이상이면 본 검색.
 *
 * 서버가 본 검색을 두 글자 이상으로 제한하고 "한 글자는 자동완성을 쓰라"고
 * 명시하고 있어, 화면에서 길이에 따라 엔드포인트를 갈아 끼운다. 공백·특수문자가
 * 섞인 입력은 서버 @Pattern에 걸려 400이 되므로 요청 자체를 보내지 않는다.
 */
export default function useAccountSearch(
	query: string,
	{ artistsOnly = false, size }: AccountSearchOptions = {},
) {
	const trimmed = query.trim();
	const isValid = trimmed.length > 0 && isSearchableQuery(trimmed);
	const useAutocomplete = trimmed.length === 1;

	return useQuery({
		queryKey: [...accountSearchQueryKey, { q: trimmed, artistsOnly, size }],
		enabled: isValid,
		queryFn: () => {
			if (useAutocomplete) {
				return artistsOnly
					? autocompleteArtists(trimmed, size ?? 10)
					: autocompleteAccounts(trimmed, size ?? 10);
			}
			return artistsOnly
				? searchArtists(trimmed, size ?? 20)
				: searchAccounts(trimmed, size ?? 20);
		},
		// 같은 검색어를 다시 치는 일이 흔해 잠깐 캐시해 둔다.
		staleTime: 30_000,
	});
}
