/**
 * 백엔드 Notifications 도메인 타입
 * 기준: https://starttoo.duckdns.org/v3/api-docs (2026-07-31 확인)
 *
 * 목록 엔드포인트는 `GET /notifications` 하나뿐이고 미확인 알림만 내려온다.
 * 별도의 preview 경로는 없으며 size=10으로 부르면 "미확인 Top 10"과 같다.
 */

export type NotificationType =
	| "POST_LIKE"
	| "POST_COMMENT"
	| "COMMENT_LIKE"
	| "FOLLOW"
	| "NEW_DM"
	| "SYSTEM";

/** 개별 알림 항목 */
export type NotificationItem = {
	notificationSeq: number;
	/** 행위자 회원 seq (SYSTEM 알림은 null) */
	actorSeq: number | null;
	notificationType: NotificationType;
	/**
	 * 알림 종류별 대상 식별자. NEW_DM은 DM 방 seq, 게시글 알림은 게시글 seq다.
	 * 대상이 없는 알림(SYSTEM 등)은 null.
	 */
	referenceSeq: number | null;
	title: string;
	body: string;
	regDttm: string;
};

/** GET /notifications — 미확인 알림 커서 페이지 */
export type NotificationPage = {
	items: NotificationItem[];
	/** 다음 페이지 요청에 그대로 넘기는 불투명 커서. 없으면 null */
	nextCursor: string | null;
	hasNext: boolean;
	/** 이번 응답에 담긴 실제 항목 수 */
	size: number;
};

/** GET /notifications/unread-counts — 타입별 미확인 개수 */
export type UnreadCountsResponse = {
	/** byType 값의 합 */
	total: number;
	/** 알림이 없는 타입도 0으로 모두 포함된다 */
	byType: Partial<Record<NotificationType, number>>;
};

/** GET /notifications 쿼리 파라미터 */
export type NotificationPageQuery = {
	/** 이전 응답의 nextCursor를 그대로 넘긴다 */
	cursor?: string;
	/** 1~100, 기본 30 */
	size?: number;
};
