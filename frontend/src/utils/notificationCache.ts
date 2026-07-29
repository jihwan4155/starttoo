import type { InfiniteData } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type {
	NotificationItem,
	NotificationPage,
	NotificationPreview,
} from "../types/notification";
import { notificationPreviewQueryKey } from "../hooks/queries/useNotificationPreview";
import { unreadNotificationsQueryKey } from "../hooks/queries/useUnreadNotifications";

/** 단일 알림을 캐시에서 즉시 제거 */
export function optimisticallyRemoveNotification(
	queryClient: QueryClient,
	item: NotificationItem,
) {
	const matches = (target: NotificationItem) =>
		target.notificationId === item.notificationId;
	const delta = item.notificationType === "NEW_DM" ? item.count : 1;

	queryClient.setQueryData<NotificationPreview>(
		notificationPreviewQueryKey,
		(old) => {
			if (!old) return old;
			return {
				items: old.items.filter((target) => !matches(target)),
				unreadCount: Math.max(0, old.unreadCount - delta),
			};
		},
	);

	queryClient.setQueriesData<InfiniteData<NotificationPage>>(
		{ queryKey: unreadNotificationsQueryKey },
		(old) => {
			if (!old) return old;
			return {
				...old,
				pages: old.pages.map((page, index) => ({
					...page,
					items: page.items.filter((target) => !matches(target)),
					unreadCount:
						index === 0
							? Math.max(0, page.unreadCount - delta)
							: page.unreadCount,
				})),
			};
		},
	);
}

/** DM 방 묶음 알림을 캐시에서 즉시 제거 */
export function optimisticallyRemoveDmRoomBundle(
	queryClient: QueryClient,
	item: NotificationItem,
) {
	const roomId = item.referenceId;
	if (roomId == null || item.notificationType !== "NEW_DM") return;

	const matchesRoom = (target: NotificationItem) =>
		target.notificationType === "NEW_DM" && target.referenceId === roomId;

	queryClient.setQueryData<NotificationPreview>(
		notificationPreviewQueryKey,
		(old) => {
			if (!old) return old;
			return {
				items: old.items.filter((target) => !matchesRoom(target)),
				unreadCount: Math.max(0, old.unreadCount - item.count),
			};
		},
	);

	queryClient.setQueriesData<InfiniteData<NotificationPage>>(
		{ queryKey: unreadNotificationsQueryKey },
		(old) => {
			if (!old) return old;
			return {
				...old,
				pages: old.pages.map((page, index) => ({
					...page,
					items: page.items.filter((target) => !matchesRoom(target)),
					unreadCount:
						index === 0
							? Math.max(0, page.unreadCount - item.count)
							: page.unreadCount,
				})),
			};
		},
	);
}
