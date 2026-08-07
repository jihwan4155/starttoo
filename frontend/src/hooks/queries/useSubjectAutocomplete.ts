import { useQuery } from "@tanstack/react-query";
import { autocompleteSubjects } from "../../services/searchApi";
import { isSearchableQuery } from "../../types/search";

export const subjectAutocompleteQueryKey = ["search", "subjects"] as const;

/** GET /search/subjects/autocomplete — 피드 검색창의 추천어 (1글자부터) */
export default function useSubjectAutocomplete(query: string, size = 8) {
	const trimmed = query.trim();
	const isValid = trimmed.length > 0 && isSearchableQuery(trimmed);

	return useQuery({
		queryKey: [...subjectAutocompleteQueryKey, { q: trimmed, size }],
		enabled: isValid,
		queryFn: () => autocompleteSubjects(trimmed, size),
		staleTime: 60_000,
	});
}
