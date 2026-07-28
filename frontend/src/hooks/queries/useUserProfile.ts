import { useQuery } from "@tanstack/react-query";
import { fetchUserProfile } from "../../services/userApi";

export const userProfileQueryKey = (userId: number) =>
	["users", userId] as const;

/** GET /users/{userId} */
export default function useUserProfile(userId: number) {
	return useQuery({
		queryKey: userProfileQueryKey(userId),
		queryFn: () => fetchUserProfile(userId),
		enabled: userId > 0,
	});
}
