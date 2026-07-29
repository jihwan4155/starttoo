import type { NotificationItem } from "../types/notification";

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

/** 알림 타입·참조에 따른 이동 경로 (null이면 현재 화면 유지) */
export function getNotificationTargetPath(
	item: NotificationItem,
): string | null {
	if (item.notificationType === "NEW_DM" && item.referenceId != null) {
		return "/dm";
	}
	if (
		item.notificationType === "SYSTEM" &&
		item.referenceType === "ARTIST"
	) {
		return "/mypage";
	}
	return null;
}

export function getNotificationTypeLabel(type: NotificationItem["notificationType"]) {
	return type === "NEW_DM" ? "메시지" : "시스템";
}
