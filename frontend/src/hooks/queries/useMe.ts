import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../../services/userApi";
import useAuthStore from "../../store/useAuthStore";

export const meQueryKey = ["users", "me"] as const;

/** GET /users/me */
export default function useMe() {
	const accessToken = useAuthStore((s) => s.accessToken);
	const userId = useAuthStore((s) => s.user?.userId);

	return useQuery({
		queryKey: [...meQueryKey, userId],
		queryFn: fetchMe,
		enabled: Boolean(accessToken && userId),
		staleTime: 60_000,
	});
}
