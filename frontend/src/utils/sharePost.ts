import type { Post } from "../types/community";

/** 피드 상세로 바로 여는 주소 — App.tsx의 /posts/:postId 라우트와 짝이다 */
export function postPermalink(postId: number): string {
	return `${window.location.origin}/posts/${postId}`;
}

/** 공유 알림 문구 — 보낸 사람 이름을 모르면 이름 없이 쓴다 */
export function shareNoticeText(sharerNickname?: string | null): string {
	const name = sharerNickname?.trim();
	return name ? `${name}님이 게시글을 공유했습니다` : "게시글을 공유했습니다";
}

/**
 * DM으로 보낼 본문.
 *
 * DM 메시지 타입이 TEXT·IMAGE뿐이라 피드를 첨부할 방법이 없다. 한 줄 안내로
 * 무엇인지 알려 주고, 실제 열람은 주소로 넘긴다.
 *
 * <p>본문·작성자 미리보기는 넣지 않는다. 대화방에서는 아래 카드가 어차피 같은
 * 내용을 보여 주고, 방 목록의 마지막 메시지 자리에는 인용문과 주소가 뒤엉킨
 * 한 줄("OOO님의 게시물 "ㅇㅇ" htt…")만 남았다.
 */
export function shareMessageText(post: Post, sharerNickname?: string | null): string {
	return `${shareNoticeText(sharerNickname)}\n${postPermalink(post.id)}`;
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

/**
 * 방 목록의 "마지막 메시지" 한 줄.
 *
 * 공유 메시지는 주소가 그대로 비쳐 보이므로 안내 문구만 남긴다. 사용자가 직접
 * 붙여 넣은 주소도 같은 규칙으로 정리한다(대화방에서도 카드로 보여 주므로).
 */
export function dmPreviewText(textContent: string | null): string | null {
	if (!textContent) return null;
	const shared = parseSharedPost(textContent);
	if (!shared) return textContent;
	return shared.text ?? shareNoticeText();
}
