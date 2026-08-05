import type { Post } from "../types/community";

/** 게시글 상세로 바로 여는 주소 — App.tsx의 /posts/:postId 라우트와 짝이다 */
export function postPermalink(postId: number): string {
	return `${window.location.origin}/posts/${postId}`;
}

/** 본문 미리보기 최대 길이 — 넘으면 잘라내고 …을 붙인다 */
const PREVIEW_LIMIT = 40;

/**
 * DM으로 보낼 본문.
 *
 * DM 메시지 타입이 TEXT·IMAGE뿐이라 게시글을 첨부할 방법이 없다. 작성자와
 * 내용 일부로 무엇인지 알려 주고, 실제 열람은 주소로 넘긴다.
 */
export function shareMessageText(post: Post): string {
	const preview = post.caption?.trim().replace(/\s+/g, " ") ?? "";
	const shortened =
		preview.length > PREVIEW_LIMIT
			? `${preview.slice(0, PREVIEW_LIMIT)}…`
			: preview;
	const head = `${post.author.nickname}님의 게시글`;
	return shortened
		? `${head}\n"${shortened}"\n${postPermalink(post.id)}`
		: `${head}\n${postPermalink(post.id)}`;
}
