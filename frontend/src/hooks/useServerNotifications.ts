import { useCallback, useEffect, useState } from "react";
import useAuthStore from "../store/useAuthStore";
import {
	getUnreadPreview,
	markAllNotificationsRead,
	markNotificationRead,
} from "../services/notificationApi";
import type { NotificationItem } from "../types/notification";

/**
 * 서버 알림(GET /notifications/unread/preview) 연동 훅.
 * - 로그인(accessToken) 상태에서만 조회한다.
 * - 뱃지 숫자는 unreadCount(메시지 기준), 목록은 items(방/건별 묶음 행)를 사용한다.
 */
export function useServerNotifications() {
	const accessToken = useAuthStore((s) => s.accessToken);
	const enabled = Boolean(accessToken);

	const [items, setItems] = useState<NotificationItem[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refetch = useCallback(async () => {
		if (!enabled) {
			setItems([]);
			setUnreadCount(0);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const res = await getUnreadPreview();
			setItems(res.items);
			setUnreadCount(res.unreadCount);
		} catch (err) {
			setError(err instanceof Error ? err.message : "알림을 불러오지 못했습니다.");
		} finally {
			setLoading(false);
		}
	}, [enabled]);

	useEffect(() => {
		refetch();
	}, [refetch]);

	const markAll = useCallback(async () => {
		await markAllNotificationsRead();
		await refetch();
	}, [refetch]);

	const markOne = useCallback(
		async (notificationId: number) => {
			await markNotificationRead(notificationId);
			await refetch();
		},
		[refetch],
	);

	return { enabled, items, unreadCount, loading, error, refetch, markAll, markOne };
}
