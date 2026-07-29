import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	markAllNotificationsRead,
	markNotificationRead,
} from "../../services/notificationApi";
import { markDmNotificationRead } from "../../services/dmApi";
import type { NotificationItem } from "../../types/notification";
import {
	optimisticallyRemoveDmRoomBundle,
	optimisticallyRemoveNotification,
} from "../../utils/notificationCache";
import { notificationPreviewQueryKey } from "../queries/useNotificationPreview";
import { unreadNotificationsQueryKey } from "../queries/useUnreadNotifications";

function invalidateNotificationQueries(
	queryClient: ReturnType<typeof useQueryClient>,
) {
	void queryClient.invalidateQueries({ queryKey: notificationPreviewQueryKey });
	void queryClient.invalidateQueries({ queryKey: unreadNotificationsQueryKey });
}

type MarkOneVariables = {
	notificationId: number;
	item: NotificationItem;
};

type MarkAllVariables = {
	items: NotificationItem[];
};

/** PATCH /notifications/{notificationId}/read */
export function useMarkNotificationRead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ notificationId }: MarkOneVariables) =>
			markNotificationRead(notificationId),
		onMutate: ({ item }) => {
			optimisticallyRemoveNotification(queryClient, item);
		},
		onSuccess: () => invalidateNotificationQueries(queryClient),
		onError: () => invalidateNotificationQueries(queryClient),
	});
}

/** DM 방 묶음 알림 일괄 읽음 */
export function useMarkDmNotificationRead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ notificationId, item }: MarkOneVariables) => {
			if (item.referenceId == null) {
				return markNotificationRead(notificationId);
			}
			return markDmNotificationRead(
				notificationId,
				item.referenceId,
				item.count,
			);
		},
		onMutate: ({ item }) => {
			optimisticallyRemoveDmRoomBundle(queryClient, item);
		},
		onSuccess: () => invalidateNotificationQueries(queryClient),
		onError: () => invalidateNotificationQueries(queryClient),
	});
}

/** PATCH /notifications/read-all */
export function useMarkAllNotificationsRead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (_variables: MarkAllVariables) => markAllNotificationsRead(),
		onMutate: ({ items }) => {
			for (const item of items) {
				if (item.notificationType === "NEW_DM") {
					optimisticallyRemoveDmRoomBundle(queryClient, item);
				} else {
					optimisticallyRemoveNotification(queryClient, item);
				}
			}
		},
		onSuccess: () => invalidateNotificationQueries(queryClient),
		onError: () => invalidateNotificationQueries(queryClient),
	});
}
