import { useInfiniteQuery } from "@tanstack/react-query";
import { searchPosts } from "../../services/searchApi";
import { mapPostResponse } from "../../utils/mapPost";
import { isSearchableQuery } from "../../types/search";

export const postSearchQueryKey = ["search", "posts"] as const;

/**
 * GET /search/posts — subject 기반 게시물 검색 (커서 무한 스크롤)
 *
 * 커서는 postSeq(숫자) 내림차순인데 응답 nextCursor는 문자열로 내려와 숫자로
 * 되돌려 보낸다. matchedSubject는 오타가 보정된 실제 subject라 화면에서
 * "OO 검색 결과"로 보여줄 수 있다 — 페이지마다 같으므로 첫 페이지 것을 쓴다.
 */
export default function usePostSearch(query: string, size = 20) {
	const trimmed = query.trim();
	// 서버 @Pattern이 {1,50}이라 한 글자부터 보낸다 (BE a8a2020).
	const isValid = trimmed.length > 0 && isSearchableQuery(trimmed);

	return useInfiniteQuery({
		queryKey: [...postSearchQueryKey, { q: trimmed, size }],
		enabled: isValid,
		initialPageParam: undefined as number | undefined,
		queryFn: async ({ pageParam }) => {
			const page = await searchPosts({ q: trimmed, cursor: pageParam, size });
			return { ...page, items: page.items.map(mapPostResponse) };
		},
		getNextPageParam: (lastPage) =>
			lastPage.hasNext && lastPage.nextCursor
				? Number(lastPage.nextCursor)
				: undefined,
	});
}
