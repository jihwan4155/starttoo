import { useQuery } from "@tanstack/react-query";
import { getUnreadPreview } from "../../services/notificationApi";
import useAuthStore from "../../store/useAuthStore";

export const notificationPreviewQueryKey = ["notifications", "preview"] as const;

/** GET /notifications/unread/preview — TopNav 드롭다운용 */
export default function useNotificationPreview() {
	const accessToken = useAuthStore((s) => s.accessToken);

	return useQuery({
		queryKey: notificationPreviewQueryKey,
		enabled: Boolean(accessToken),
		queryFn: getUnreadPreview,
	});
}
