import useAuthStore from "../store/useAuthStore";
import useCommunityStore from "../store/useCommunityStore";
import type { Post } from "../types/community";

/**
 * 피드 GET /posts는 liked/bookmarked를 반환하지 않을 수 있어
 * 로컬 스토어( mutation·상세 조회 동기화 )와 API 값을 합친다.
 */
export default function usePostEngagement(post: Post) {
	const isAuthenticated = !!useAuthStore((s) => s.accessToken);
	const storeLiked = useCommunityStore((s) => s.liked[post.id]);
	const storeBookmarked = useCommunityStore((s) => s.bookmarked[post.id]);

	return {
		isLiked:
			isAuthenticated && storeLiked !== undefined
				? storeLiked
				: !!post.liked,
		isBookmarked:
			isAuthenticated && storeBookmarked !== undefined
				? storeBookmarked
				: !!post.bookmarked,
	};
}
