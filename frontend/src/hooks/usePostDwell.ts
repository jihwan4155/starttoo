import { useEffect } from "react";
import { recordPostDwell } from "../services/communityApi";
import useAuthStore from "../store/useAuthStore";

/** 서버가 0점 처리하는 구간 — 보내도 취향 점수가 안 바뀌니 요청을 아낀다 */
const MIN_SECONDS = 3;
/** 백엔드 DwellRequest의 @Max(3600) */
const MAX_SECONDS = 3600;

/**
 * 이 방문에서 이미 체류시간을 보낸 피드.
 *
 * 서버는 원본 체류시간이나 사용자×피드 행을 저장하지 않고 받은 초를 즉시 취향
 * 점수에 더하기만 한다. 중복 방지가 서버에 없어서 같은 피드를 여닫기만 반복해도
 * 점수가 무한히 쌓이므로 피드당 한 번으로 막는다.
 */
const sentPostIds = new Set<number>();

/**
 * 피드 상세를 보고 있는 시간을 재서 취향 점수에 반영한다.
 *
 * postId가 사라지거나(모달 닫힘) 컴포넌트가 사라질 때, 그리고 탭이 백그라운드로
 * 갈 때 보낸다. 백그라운드에 머문 시간은 실제로 본 시간이 아니므로 세지 않는다.
 * 점수 계산은 서버가 하므로 보내는 값은 초뿐이다.
 */
export default function usePostDwell(postId: number | undefined) {
	// 인증이 필요한 엔드포인트라 비로그인 상태에서는 재지 않는다.
	const isAuthenticated = !!useAuthStore((s) => s.accessToken);

	useEffect(() => {
		if (!postId || !isAuthenticated || sentPostIds.has(postId)) return;

		let accumulatedMs = 0;
		let startedAt: number | null =
			document.visibilityState === "visible" ? Date.now() : null;

		const pause = () => {
			if (startedAt === null) return;
			accumulatedMs += Date.now() - startedAt;
			startedAt = null;
		};

		const flush = () => {
			pause();
			const seconds = Math.min(
				Math.floor(accumulatedMs / 1000),
				MAX_SECONDS,
			);
			if (seconds < MIN_SECONDS || sentPostIds.has(postId)) return;
			// 요청 전에 표시해 두어야 flush가 두 번 불려도 중복 전송되지 않는다.
			sentPostIds.add(postId);
			// 화면을 떠나며 보내는 요청이라 실패해도 사용자에게 알릴 것이 없다.
			// 다음에 다시 열었을 때 재시도할 수 있도록 표시만 되돌린다.
			void recordPostDwell(postId, seconds).catch(() => {
				sentPostIds.delete(postId);
			});
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				if (startedAt === null) startedAt = Date.now();
				return;
			}
			// 탭을 벗어나면 그대로 닫힐 수 있어 여기서 확정해 보낸다.
			flush();
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			document.removeEventListener(
				"visibilitychange",
				handleVisibilityChange,
			);
			flush();
		};
	}, [postId, isAuthenticated]);
}
