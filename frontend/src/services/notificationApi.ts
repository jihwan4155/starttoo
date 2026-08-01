import { api } from "./api";
import type {
	NotificationPage,
	NotificationPageQuery,
	UnreadCountsResponse,
} from "../types/notification";

/** 벨 드롭다운에 쓰는 미확인 Top 10 개수 */
export const NOTIFICATION_PREVIEW_SIZE = 10;

/** GET /notifications — 미확인 알림 목록 (커서 페이지네이션) */
export async function getUnreadNotifications(
	query: NotificationPageQuery = {},
): Promise<NotificationPage> {
	const { data } = await api.get<NotificationPage>("/notifications", {
		params: query,
	});
	return data;
}

/**
 * 미확인 알림 Top 10.
 *
 * 전용 경로는 없다. 백엔드 문서대로 목록을 size=10으로 부르면 결과가 같다.
 */
export async function getUnreadPreview(): Promise<NotificationPage> {
	return getUnreadNotifications({ size: NOTIFICATION_PREVIEW_SIZE });
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

/** PATCH /notifications/{notificationSeq}/read — 개별 알림 읽음 */
export async function markNotificationRead(
	notificationSeq: number,
): Promise<void> {
	await api.patch(`/notifications/${notificationSeq}/read`);
}
