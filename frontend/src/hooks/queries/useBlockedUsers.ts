import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchBlockedUsers } from "../../services/userApi";

export const blockedUsersQueryKey = ["users", "me", "blocks"] as const;

type UseBlockedUsersParams = {
	/** 모달이 열렸을 때만 요청하도록 호출부에서 제어 */
	enabled?: boolean;
	size?: number;
};

/** GET /users/me/blocks — 내가 차단한 회원 목록 */
export default function useBlockedUsers({
	enabled = true,
	size = 30,
}: UseBlockedUsersParams = {}) {
	return useInfiniteQuery({
		queryKey: [...blockedUsersQueryKey, { size }],
		enabled,
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam }) => fetchBlockedUsers({ size, cursor: pageParam }),
		getNextPageParam: (lastPage) =>
			lastPage.hasNext && lastPage.nextCursor ? lastPage.nextCursor : undefined,
	});
}
