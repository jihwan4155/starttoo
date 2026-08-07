import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
	useMarkDmNotificationRead,
	useMarkNotificationRead,
} from "./mutations/useMarkNotificationsRead";
import useDmStore from "../store/useDmStore";
import type { NotificationItem } from "../types/notification";

type NotificationActionOptions = {
	/** SYSTEM 알림 클릭 시 모달 표시 */
	onSystemOpen?: (item: NotificationItem) => void;
	/** false면 읽음 API 생략 (이미 읽은 알림) */
	markAsRead?: boolean;
};

/** 알림 클릭 — DM은 채팅방(방 단위 읽음), SYSTEM은 모달 */
export default function useNotificationAction(
	options: NotificationActionOptions = {},
) {
	const navigate = useNavigate();
	const openRoom = useDmStore((s) => s.openRoom);
	const { mutateAsync: markRead } = useMarkNotificationRead();
	const { mutateAsync: markDmRead } = useMarkDmNotificationRead();
	const { onSystemOpen, markAsRead = true } = options;

	return useCallback(
		async (item: NotificationItem) => {
			if (markAsRead) {
				if (item.notificationType === "NEW_DM") {
					await markDmRead({
						notificationSeq: item.notificationSeq,
						item,
					});
				} else {
					await markRead({ notificationSeq: item.notificationSeq, item });
				}
			}

			if (item.notificationType === "SYSTEM") {
				onSystemOpen?.(item);
				return;
			}

			if (item.notificationType === "NEW_DM" && item.referenceSeq != null) {
				openRoom(item.referenceSeq);
				navigate("/dm");
			}
			// 피드·팔로우 알림은 아직 이동할 상세 화면이 없어 읽음 처리까지만 한다.
		},
		[markAsRead, markDmRead, markRead, navigate, onSystemOpen, openRoom],
	);
}
