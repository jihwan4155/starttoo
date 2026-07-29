import type { Post } from "../types/community";

/** 피드에서 숨김 처리된 게시글 제외 (오버레이 예외 없음) */
export function filterVisiblePosts(
	posts: Post[],
	hiddenIds: Record<number, boolean>,
): Post[] {
	return posts.filter((post) => !hiddenIds[post.id] && !post.hidden);
}

/**
 * 커뮤니티 피드용 — 숨김 게시글은 제외하되,
 * 현재 방문 중 overlayHiddenIds에 있으면 오버레이 표시를 위해 유지
 */
export function filterFeedPosts(
	posts: Post[],
	hiddenIds: Record<number, boolean>,
	overlayHiddenIds: Record<number, boolean>,
): Post[] {
	return posts.filter((post) => {
		const isHidden = Boolean(hiddenIds[post.id] || post.hidden);
		if (!isHidden) return true;
		return Boolean(overlayHiddenIds[post.id]);
	});
}

/** 캡션·작성자 닉네임 기준 클라이언트 검색 (POST /posts/search 501 대체) */
export function filterPostsByKeyword(posts: Post[], keyword: string): Post[] {
	const q = keyword.trim().toLowerCase();
	if (!q) return posts;
	return posts.filter(
		(post) =>
			post.caption.toLowerCase().includes(q) ||
			post.author.nickname.toLowerCase().includes(q),
	);
}
