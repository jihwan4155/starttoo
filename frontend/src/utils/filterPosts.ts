import type { Post } from "../types/community";

/** 피드에서 숨김 처리된 게시글 제외 */
export function filterVisiblePosts(
	posts: Post[],
	hiddenIds: Record<number, boolean>,
): Post[] {
	return posts.filter((post) => !hiddenIds[post.id] && !post.hidden);
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
