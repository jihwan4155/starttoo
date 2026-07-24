import useUserStore from "../store/useUserStore";
import type { PostAuthor } from "../types/community";
import {
	DEFAULT_PROFILE_IMAGE,
	profilePath,
	resolveAvatar,
} from "../utils/profile";

/**
 * 작성자 표시 정보(닉네임·아바타·프로필 경로)를 해석한다.
 * 내가 작성한 콘텐츠(isMe)는 프로필 스토어를 실시간으로 따라가므로,
 * 프로필을 수정하면 이미 올린 글/댓글에도 즉시 반영된다.
 * profileTo: 프로필 이미지·이름 클릭 시 이동할 경로 (내 콘텐츠면 마이페이지).
 */
export default function useAuthorDisplay(author: PostAuthor) {
	const myNickname = useUserStore((s) => s.nickname);
	const myAvatar = useUserStore((s) => s.avatarUrl);

	// isMe 플래그(신규 콘텐츠) 또는 현재 닉네임과 동일(과거 콘텐츠)하면 내 것으로 간주
	const isMine = author.isMe || author.nickname === myNickname;

	if (isMine) {
		return {
			nickname: myNickname,
			avatarUrl: myAvatar || DEFAULT_PROFILE_IMAGE,
			profileTo: "/mypage",
			isMine: true,
		};
	}
	return {
		nickname: author.nickname,
		avatarUrl: resolveAvatar(author.avatarUrl, author.nickname),
		profileTo: profilePath(author.nickname),
		isMine: false,
	};
}
