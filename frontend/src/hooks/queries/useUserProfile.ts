import { useQuery } from "@tanstack/react-query";
import { fetchUserProfile } from "../../services/userApi";
import useAuthStore from "../../store/useAuthStore";

export const userProfileQueryKey = (userId: number) =>
	["users", userId] as const;

/** GET /users/{userId} */
export default function useUserProfile(userId: number) {
	const viewerUserId = useAuthStore((s) => s.user?.userId);

	return useQuery({
		queryKey: userProfileQueryKey(userId),
		queryFn: () => fetchUserProfile(userId, viewerUserId),
		enabled: userId > 0,
	});
}
