import useAuthStore from "../store/useAuthStore";
import useUserStore from "../store/useUserStore";
import type { PostAuthor } from "../types/community";
import {
	DEFAULT_PROFILE_IMAGE,
	profilePath,
	resolveAvatar,
} from "../utils/profile";

/**
 * 작성자 표시 정보(닉네임·아바타·프로필 경로)를 해석한다.
 * 로그인 사용자와 author.userId가 일치하면 내 콘텐츠로 처리한다.
 */
export default function useAuthorDisplay(author: PostAuthor) {
	const authUser = useAuthStore((s) => s.user);
	const myNickname = useUserStore((s) => s.nickname);
	const myAvatar = useUserStore((s) => s.avatarUrl);

	const isMine =
		(authUser != null &&
			author.userId != null &&
			authUser.userId === author.userId) ||
		author.isMe ||
		author.nickname === myNickname;

	if (isMine) {
		const nickname = authUser?.nickname ?? myNickname;
		const avatarUrl =
			authUser && "profileImageUrl" in authUser && authUser.profileImageUrl
				? authUser.profileImageUrl
				: myAvatar || DEFAULT_PROFILE_IMAGE;
		return {
			nickname,
			avatarUrl,
			profileTo: "/mypage",
			isMine: true,
		};
	}
	return {
		nickname: author.nickname,
		avatarUrl: resolveAvatar(author.avatarUrl, author.nickname),
		profileTo: author.userId != null ? profilePath(author.userId) : "/posts",
		isMine: false,
	};
}
