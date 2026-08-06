import { useMutation, useQueryClient } from "@tanstack/react-query";
import { blockUser, unblockUser } from "../../services/userApi";
import { dmRoomsQueryKey } from "../queries/useDmRooms";
import { postsQueryKey } from "../queries/usePosts";
import { userProfileQueryKey } from "../queries/useUserProfile";

type BlockVariables = {
	userId: number;
	/** true면 차단, false면 차단 해제 */
	blocked: boolean;
};

/**
 * PUT·DELETE /users/{userSeq}/block
 *
 * 차단은 되돌아올 수 없는 화면 전환을 부른다 — 서버가 프로필·팔로우 목록을
 * USER_NOT_FOUND로, DM 입장·전송을 FORBIDDEN으로 막기 때문이다. 그래서 낙관적
 * 갱신을 하지 않고, 성공한 뒤에 관련 캐시를 통째로 버린다.
 */
export default function useBlockUser() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ userId, blocked }: BlockVariables) =>
			blocked ? blockUser(userId) : unblockUser(userId),
		onSuccess: (_data, { userId }) => {
			// 차단하면 더 볼 수 없는 프로필이라 캐시를 남겨 둘 이유가 없다.
			// 이 키는 ["users", userId]라 팔로워·팔로우 목록 캐시까지 같이 걷힌다.
			queryClient.removeQueries({ queryKey: userProfileQueryKey(userId) });
			// 팔로우가 끊기고 상대 글이 목록에서 빠지므로 피드·DM 목록을 다시 받는다.
			// postsQueryKey(["posts"])는 내 글·상대 글 목록의 접두사도 함께 덮는다.
			void queryClient.invalidateQueries({ queryKey: postsQueryKey });
			void queryClient.invalidateQueries({ queryKey: dmRoomsQueryKey });
		},
	});
}
