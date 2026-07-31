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

/** 목록·미확인 수 캐시를 한 번에 되돌린다 (키 prefix로 세 쿼리 모두 포함) */
function invalidateNotificationQueries(
	queryClient: ReturnType<typeof useQueryClient>,
) {
	void queryClient.invalidateQueries({ queryKey: ["notifications"] });
}

type MarkOneVariables = {
	notificationSeq: number;
	item: NotificationItem;
};

type MarkAllVariables = {
	items: NotificationItem[];
};

/** PATCH /notifications/{notificationSeq}/read */
export function useMarkNotificationRead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ notificationSeq }: MarkOneVariables) =>
			markNotificationRead(notificationSeq),
		onMutate: ({ item }) => {
			optimisticallyRemoveNotification(queryClient, item);
		},
		onSuccess: () => invalidateNotificationQueries(queryClient),
		onError: () => invalidateNotificationQueries(queryClient),
	});
}

/** DM 방 알림 일괄 읽음 */
export function useMarkDmNotificationRead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ notificationSeq, item }: MarkOneVariables) => {
			if (item.referenceSeq == null) {
				return markNotificationRead(notificationSeq);
			}
			return markDmNotificationRead(notificationSeq, item.referenceSeq);
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

	// 요청 본문은 없지만 낙관적 제거를 위해 onMutate가 목록을 받아야 한다.
	return useMutation<void, Error, MarkAllVariables>({
		mutationFn: () => markAllNotificationsRead(),
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
