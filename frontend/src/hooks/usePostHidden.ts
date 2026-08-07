import useCommunityStore from "../store/useCommunityStore";

/** 현재 방문 중 오버레이로 표시할 숨김 피드인지 */
export default function usePostHiddenOverlay(postId: number) {
	return useCommunityStore((s) => Boolean(s.overlayHiddenIds[postId]));
}
