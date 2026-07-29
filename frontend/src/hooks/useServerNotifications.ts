import useAuthStore from "../store/useAuthStore";
import useNotificationPreview from "./queries/useNotificationPreview";
import {
	useMarkAllNotificationsRead,
	useMarkNotificationRead,
} from "./mutations/useMarkNotificationsRead";

/**
 * @deprecated TopNav·NotificationsPage는 react-query 훅을 직접 사용합니다.
 * 하위 호환용 래퍼.
 */
export function useServerNotifications() {
	const accessToken = useAuthStore((s) => s.accessToken);
	const { data, isLoading, error, refetch } = useNotificationPreview();
	const { mutateAsync: markOneAsync } = useMarkNotificationRead();
	const { mutateAsync: markAllAsync } = useMarkAllNotificationsRead();

	return {
		enabled: Boolean(accessToken),
		items: data?.items ?? [],
		unreadCount: data?.unreadCount ?? 0,
		loading: isLoading,
		error: error?.message ?? null,
		refetch: async () => {
			await refetch();
		},
		markAll: markAllAsync,
		markOne: markOneAsync,
	};
}
