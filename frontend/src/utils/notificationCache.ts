import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type {
	NotificationItem,
	NotificationPage,
	UnreadCountsResponse,
} from "../types/notification";
import { notificationPreviewQueryKey } from "../hooks/queries/useNotificationPreview";
import { unreadCountsQueryKey } from "../hooks/queries/useUnreadCounts";
import { unreadNotificationsQueryKey } from "../hooks/queries/useUnreadNotifications";

/**
 * 조건에 맞는 알림을 목록 캐시들에서 지우고 미확인 수를 그만큼 줄인다.
 *
 * 총 미확인 수는 목록 응답이 아니라 별도 unread-counts 캐시에 있어 함께 손봐야 한다.
 * 어차피 뮤테이션이 끝나면 무효화로 서버 값으로 덮이므로, 여기서는 눈에 보이는
 * 뱃지·목록만 즉시 맞춰 준다.
 */
function removeMatching(
	queryClient: QueryClient,
	matches: (target: NotificationItem) => boolean,
) {
	let removedFromPreview = 0;
	let removedFromList = 0;

	queryClient.setQueryData<NotificationPage>(
		notificationPreviewQueryKey,
		(old) => {
			if (!old) return old;
			const items = old.items.filter((target) => !matches(target));
			removedFromPreview = old.items.length - items.length;
			return { ...old, items, size: items.length };
		},
	);

	queryClient.setQueriesData<InfiniteData<NotificationPage>>(
		{ queryKey: unreadNotificationsQueryKey },
		(old) => {
			if (!old) return old;
			return {
				...old,
				pages: old.pages.map((page) => {
					const items = page.items.filter((target) => !matches(target));
					removedFromList += page.items.length - items.length;
					return { ...page, items, size: items.length };
				}),
			};
		},
	);

	// 두 캐시는 같은 알림을 담고 있어 합치면 이중으로 센다. 한쪽 값만 쓴다.
	const removed = removedFromPreview || removedFromList;
	if (removed === 0) return;

	queryClient.setQueryData<UnreadCountsResponse>(unreadCountsQueryKey, (old) =>
		old ? { ...old, total: Math.max(0, old.total - removed) } : old,
	);
}

/** 단일 알림을 캐시에서 즉시 제거 */
export function optimisticallyRemoveNotification(
	queryClient: QueryClient,
	item: NotificationItem,
) {
	removeMatching(
		queryClient,
		(target) => target.notificationSeq === item.notificationSeq,
	);
}

/** 같은 DM 방의 미확인 알림을 캐시에서 한꺼번에 제거 */
export function optimisticallyRemoveDmRoomBundle(
	queryClient: QueryClient,
	item: NotificationItem,
) {
	const roomSeq = item.referenceSeq;
	if (roomSeq == null || item.notificationType !== "NEW_DM") return;

	removeMatching(
		queryClient,
		(target) =>
			target.notificationType === "NEW_DM" && target.referenceSeq === roomSeq,
	);
}
