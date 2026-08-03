import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchFollowers, fetchFollowing } from "../../services/userApi";

/** 팔로워(나를 팔로우) · 팔로우(내가 팔로우) 중 어느 목록인지 */
export type FollowListKind = "followers" | "following";

export const followListQueryKey = (userId: number, kind: FollowListKind) =>
	["users", userId, kind] as const;

type UseFollowListParams = {
	userId: number;
	kind: FollowListKind;
	/** 모달이 열렸을 때만 요청하도록 호출부에서 제어 */
	enabled?: boolean;
	size?: number;
};

/** GET /users/{userId}/followers · /users/{userId}/following */
export default function useFollowList({
	userId,
	kind,
	enabled = true,
	size = 30,
}: UseFollowListParams) {
	return useInfiniteQuery({
		queryKey: [...followListQueryKey(userId, kind), { size }],
		enabled: enabled && userId > 0,
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam }) => {
			const fetchPage = kind === "followers" ? fetchFollowers : fetchFollowing;
			return fetchPage(userId, { size, cursor: pageParam });
		},
		getNextPageParam: (lastPage) =>
			lastPage.hasNext && lastPage.nextCursor ? lastPage.nextCursor : undefined,
	});
}
