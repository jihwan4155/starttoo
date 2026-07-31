import type { NotificationType } from "../types/notification";

/** ISO 시각 → 오늘이면 HH:MM, 아니면 M/D */
export function formatNotifTime(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	const now = new Date();
	const sameDay =
		d.getFullYear() === now.getFullYear() &&
		d.getMonth() === now.getMonth() &&
		d.getDate() === now.getDate();
	return sameDay
		? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
		: `${d.getMonth() + 1}/${d.getDate()}`;
}

const TYPE_LABELS: Record<NotificationType, string> = {
	POST_LIKE: "좋아요",
	POST_COMMENT: "댓글",
	COMMENT_LIKE: "댓글 좋아요",
	FOLLOW: "팔로우",
	NEW_DM: "메시지",
	SYSTEM: "시스템",
};

export function getNotificationTypeLabel(type: NotificationType): string {
	return TYPE_LABELS[type] ?? "알림";
}
