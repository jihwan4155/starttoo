import { useMutation, useQueryClient } from "@tanstack/react-query";
import { followUser, unfollowUser } from "../../services/userApi";
import type { PublicProfileResponse } from "../../types/user";
import { userProfileQueryKey } from "../queries/useUserProfile";

type ToggleFollowVariables = {
	userId: number;
	following: boolean;
};

type FollowMutationContext = {
	previous?: PublicProfileResponse;
};

/** POST/DELETE /users/{userId}/follow */
export default function useToggleFollow() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ userId, following }: ToggleFollowVariables) =>
			following ? unfollowUser(userId) : followUser(userId),
		onMutate: async ({ userId, following }) => {
			const key = userProfileQueryKey(userId);
			await queryClient.cancelQueries({ queryKey: key });
			const previous = queryClient.getQueryData<PublicProfileResponse>(key);
			if (previous) {
				queryClient.setQueryData<PublicProfileResponse>(key, {
					...previous,
					isFollowing: !following,
					followerCount: following
						? Math.max(0, previous.followerCount - 1)
						: previous.followerCount + 1,
				});
			}
			return { previous } satisfies FollowMutationContext;
		},
		onSuccess: (data, { userId }) => {
			queryClient.setQueryData<PublicProfileResponse>(
				userProfileQueryKey(userId),
				(old) =>
					old
						? {
								...old,
								isFollowing: data.following,
							}
						: old,
			);
		},
		onError: (_err, { userId }, context) => {
			if (context?.previous) {
				queryClient.setQueryData(
					userProfileQueryKey(userId),
					context.previous,
				);
			}
		},
	});
}
