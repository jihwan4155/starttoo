import type { Post } from "../types/community";

/** 피드 상세로 바로 여는 주소 — App.tsx의 /posts/:postId 라우트와 짝이다 */
export function postPermalink(postId: number): string {
	return `${window.location.origin}/posts/${postId}`;
}

/** 본문 미리보기 최대 길이 — 넘으면 잘라내고 …을 붙인다 */
const PREVIEW_LIMIT = 40;

/**
 * DM으로 보낼 본문.
 *
 * DM 메시지 타입이 TEXT·IMAGE뿐이라 피드를 첨부할 방법이 없다. 작성자와
 * 내용 일부로 무엇인지 알려 주고, 실제 열람은 주소로 넘긴다.
 */
export function shareMessageText(post: Post): string {
	const preview = post.caption?.trim().replace(/\s+/g, " ") ?? "";
	const shortened =
		preview.length > PREVIEW_LIMIT
			? `${preview.slice(0, PREVIEW_LIMIT)}…`
			: preview;
	const head = `${post.author.nickname}님의 피드`;
	return shortened
		? `${head}\n"${shortened}"\n${postPermalink(post.id)}`
		: `${head}\n${postPermalink(post.id)}`;
}

/**
 * 우리 피드 주소만 골라낸다 — 호스트가 어디든(로컬·배포·프리뷰) 경로만 본다.
 * 주소를 통째로 비교하면 배포에서 보낸 링크가 로컬에서 안 잡힌다.
 */
const PERMALINK_PATTERN = /https?:\/\/[^\s]*\/posts\/(\d+)(?![\d/])/;

export type SharedPostLink = {
	postId: number;
	/** 링크를 뺀 나머지 본문 — 없으면 null */
	text: string | null;
};

/**
 * DM 본문에서 공유된 피드를 읽어낸다.
 *
 * 메시지 타입이 TEXT뿐이라 공유인지 아닌지는 본문으로 판단할 수밖에 없다.
 * 사용자가 직접 주소를 붙여 넣은 경우도 같은 카드로 보여 주는 편이 자연스럽다.
 */
export function parseSharedPost(
	textContent: string | null,
): SharedPostLink | null {
	if (!textContent) return null;
	const match = PERMALINK_PATTERN.exec(textContent);
	if (!match) return null;
	const postId = Number(match[1]);
	if (!Number.isInteger(postId) || postId <= 0) return null;
	const rest = textContent.replace(match[0], "").trim();
	return { postId, text: rest || null };
}
