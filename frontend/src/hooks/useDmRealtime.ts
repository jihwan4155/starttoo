import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
	DM_EVENTS_DESTINATION,
	NOTIFICATIONS_DESTINATION,
	connectRealtime,
	disconnectRealtime,
	subscribeRealtime,
} from "../services/realtimeClient";
import useAuthStore from "../store/useAuthStore";
import { dmMessagesQueryKey } from "./queries/useDmMessages";
import { dmRoomsQueryKey } from "./queries/useDmRooms";
import type { DmRealtimeEvent } from "../types/dm";

function isDmRealtimeEvent(value: unknown): value is DmRealtimeEvent {
	if (!value || typeof value !== "object") return false;
	const event = value as Partial<DmRealtimeEvent>;
	return (
		typeof event.eventId === "string" &&
		typeof event.dmRoomSeq === "number" &&
		(event.eventType === "MESSAGE_CREATED" ||
			event.eventType === "MESSAGES_READ")
	);
}

/**
 * DM·알림 실시간 수신 — MainLayout에서 한 번 실행한다.
 *
 * 서버 이벤트를 화면 상태에 직접 병합하지 않고 관련 쿼리를 무효화한다.
 * 이벤트에 실린 메시지를 캐시에 끼워 넣으면 커서 페이지 경계와 정렬을 직접
 * 관리해야 하는데, 재조회 한 번이 훨씬 단순하고 누락도 없다. 이벤트는 "지금
 * 다시 읽어라"는 신호로만 쓴다.
 */
export default function useDmRealtime() {
	const accessToken = useAuthStore((s) => s.accessToken);
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!accessToken) {
			disconnectRealtime();
			return;
		}

		connectRealtime(accessToken);

		const unsubscribeDm = subscribeRealtime(
			DM_EVENTS_DESTINATION,
			(payload) => {
				if (!isDmRealtimeEvent(payload)) return;
				void queryClient.invalidateQueries({
					queryKey: dmMessagesQueryKey(payload.dmRoomSeq),
				});
				// 목록의 미리보기·안읽음 수도 같이 흔들린다.
				void queryClient.invalidateQueries({ queryKey: dmRoomsQueryKey });
				if (payload.eventType === "MESSAGE_CREATED") {
					void queryClient.invalidateQueries({
						queryKey: ["notifications"],
					});
				}
			},
		);

		const unsubscribeNotifications = subscribeRealtime(
			NOTIFICATIONS_DESTINATION,
			() => {
				void queryClient.invalidateQueries({ queryKey: ["notifications"] });
			},
		);

		return () => {
			unsubscribeDm();
			unsubscribeNotifications();
		};
	}, [accessToken, queryClient]);
}
