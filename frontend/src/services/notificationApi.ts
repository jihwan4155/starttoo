import { api } from "./api";
import type {
	NotificationPage,
	NotificationPageQuery,
	NotificationPreview,
	UnreadCountsResponse,
} from "../types/notification";

/** GET /notifications/unread — 미확인 알림 전체 목록 (커서 페이지네이션) */
export async function getUnreadNotifications(
	query: NotificationPageQuery = {},
): Promise<NotificationPage> {
	const { data } = await api.get<NotificationPage>("/notifications/unread", {
		params: query,
	});
	return data;
}

/** GET /notifications/unread/preview — 미확인 알림 Top 10 */
export async function getUnreadPreview(): Promise<NotificationPreview> {
	const { data } = await api.get<NotificationPreview>(
		"/notifications/unread/preview",
	);
	return data;
}

/** GET /notifications/unread-counts — 미확인 알림 타입별 개수 */
export async function getUnreadCounts(): Promise<UnreadCountsResponse> {
	const { data } = await api.get<UnreadCountsResponse>(
		"/notifications/unread-counts",
	);
	return data;
}

/** PATCH /notifications/read-all — 전체 알림 읽음 */
export async function markAllNotificationsRead(): Promise<void> {
	await api.patch("/notifications/read-all");
}

/** PATCH /notifications/{notificationId}/read — 개별 알림 읽음 */
export async function markNotificationRead(
	notificationId: number,
): Promise<void> {
	await api.patch(`/notifications/${notificationId}/read`);
}
