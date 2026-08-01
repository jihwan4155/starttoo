import { useQuery } from "@tanstack/react-query";
import { getUnreadCounts } from "../../services/notificationApi";
import useAuthStore from "../../store/useAuthStore";

export const unreadCountsQueryKey = ["notifications", "unread-counts"] as const;

/**
 * GET /notifications/unread-counts — 벨 뱃지 숫자용.
 *
 * 목록 응답에는 총 미확인 수가 없어서 개수는 이 엔드포인트에서 따로 받아야 한다.
 * 읽음 처리 뮤테이션이 이 키를 무효화하므로 staleTime은 포커스 전환마다
 * 다시 부르지 않기 위한 것뿐이다.
 */
export default function useUnreadCounts() {
	const accessToken = useAuthStore((s) => s.accessToken);

	return useQuery({
		queryKey: unreadCountsQueryKey,
		enabled: Boolean(accessToken),
		queryFn: getUnreadCounts,
		staleTime: 30_000,
	});
}
