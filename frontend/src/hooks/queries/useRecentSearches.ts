import { useQuery } from "@tanstack/react-query";
import { fetchRecentSearches } from "../../services/userApi";
import useAuthStore from "../../store/useAuthStore";

export const recentSearchesQueryKey = ["users", "me", "recent-searches"] as const;

/** GET /users/me/recent-searches */
export default function useRecentSearches() {
	const accessToken = useAuthStore((s) => s.accessToken);
	const userId = useAuthStore((s) => s.user?.userId);

	return useQuery({
		queryKey: [...recentSearchesQueryKey, userId],
		queryFn: fetchRecentSearches,
		enabled: Boolean(accessToken && userId),
	});
}
