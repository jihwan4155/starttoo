/** 백엔드 Notifications 도메인 타입 (Swagger: Starttoo API - Notifications) */

export type NotificationType = "NEW_DM" | "SYSTEM";
export type NotificationReferenceType = "DM_ROOM" | "REPORT" | "ARTIST";

/** 개별 알림 항목 */
export type NotificationItem = {
	notificationId: number;
	notificationType: NotificationType;
	/** 행위자 회원 id (SYSTEM 알림은 null) */
	actorId: number | null;
	referenceType: NotificationReferenceType | null;
	referenceId: number | null;
	/** 동일 대상 알림 묶음 개수 (예: DM 미확인 메시지 수) */
	count: number;
	title: string;
	body: string;
	createdAt: string;
};

/** GET /notifications/unread — 커서 기반 페이지 */
export type NotificationPage = {
	items: NotificationItem[];
	nextCursor: string | null;
	hasNext: boolean;
	unreadCount: number;
};

/** GET /notifications/unread/preview — 미확인 Top 10 */
export type NotificationPreview = {
	items: NotificationItem[];
	unreadCount: number;
};

/** GET /notifications/unread-counts — 타입별 개수 */
export type UnreadCountsResponse = {
	totalCount: number;
	/** notificationType 별 미확인 개수 (예: { SYSTEM: 4, NEW_DM: 17 }) */
	counts: Record<NotificationType, number>;
};

/** GET /notifications/unread 쿼리 파라미터 */
export type NotificationPageQuery = {
	cursor?: string;
	size?: number;
};
