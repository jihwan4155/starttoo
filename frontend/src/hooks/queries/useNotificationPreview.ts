import { useQuery } from "@tanstack/react-query";
import { getUnreadPreview } from "../../services/notificationApi";
import useAuthStore from "../../store/useAuthStore";

export const notificationPreviewQueryKey = ["notifications", "preview"] as const;

/** GET /notifications?size=10 — TopNav 드롭다운용 미확인 Top 10 */
export default function useNotificationPreview() {
	const accessToken = useAuthStore((s) => s.accessToken);

	return useQuery({
		queryKey: notificationPreviewQueryKey,
		enabled: Boolean(accessToken),
		queryFn: getUnreadPreview,
		// 읽음 처리 뮤테이션이 무효화하므로, 이 값은 포커스가 돌아올 때마다
		// 다시 부르지 않게 하려는 목적이다.
		staleTime: 30_000,
	});
}
