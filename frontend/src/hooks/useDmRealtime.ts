import { useEffect, useRef } from "react";
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

/**
 * 이벤트를 모아 한 번에 처리하는 간격.
 *
 * 서버는 메시지 하나에도 보낸 사람·받는 사람 양쪽으로 이벤트를 보내고(DmService),
 * 연달아 주고받으면 이벤트가 몰린다. 도착할 때마다 재조회하면 읽기 60회/분 리밋을
 * 금방 넘기므로 이 창 안의 이벤트는 묶어서 한 번만 재조회한다.
 */
const COALESCE_MS = 700;

/** 재연결 시 같은 이벤트가 다시 올 수 있어 최근 eventId를 기억한다 */
const SEEN_EVENT_LIMIT = 200;

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
 * 서버 이벤트를 화면 상태에 직접 병합하지 않고 관련 쿼리를 무효화한다. 이벤트에
 * 실린 메시지를 캐시에 끼워 넣으면 커서 페이지 경계와 정렬을 직접 관리해야 하는데,
 * 재조회 한 번이 훨씬 단순하고 누락도 없다. 이벤트는 "지금 다시 읽어라"는 신호다.
 */
export default function useDmRealtime() {
	const accessToken = useAuthStore((s) => s.accessToken);
	const myUserSeq = useAuthStore((s) => s.user?.userId);
	const queryClient = useQueryClient();

	const seenEventIds = useRef(new Set<string>());
	const pendingRoomSeqs = useRef(new Set<number>());
	const needsNotificationRefresh = useRef(false);
	const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!accessToken) {
			disconnectRealtime();
			return;
		}

		connectRealtime(accessToken);

		const flush = async () => {
			flushTimer.current = null;
			const rooms = [...pendingRoomSeqs.current];
			const refreshNotifications = needsNotificationRefresh.current;
			pendingRoomSeqs.current.clear();
			needsNotificationRefresh.current = false;

			/*
			 * 메시지를 먼저 받고 나서 목록·뱃지를 받는다.
			 *
			 * 열어 둔 방의 메시지 조회는 서버에서 읽음 처리까지 겸한다. 이 순서를
			 * 지키지 않고 한꺼번에 무효화하면 목록이 읽음 처리 전에 먼저 응답해
			 * 안읽음 뱃지가 남은 채로 굳는다. 요청 수는 그대로다.
			 */
			await Promise.all(
				rooms.map((roomSeq) =>
					queryClient.invalidateQueries({
						queryKey: dmMessagesQueryKey(roomSeq),
					}),
				),
			);
			if (rooms.length > 0) {
				// 목록의 미리보기·안읽음 수도 같이 흔들린다.
				await queryClient.invalidateQueries({ queryKey: dmRoomsQueryKey });
			}
			if (refreshNotifications) {
				await queryClient.invalidateQueries({ queryKey: ["notifications"] });
			}
		};

		const schedule = () => {
			if (flushTimer.current != null) return;
			// 재조회 실패는 각 쿼리의 error 상태로 남는다 — 여기서 삼켜 unhandled로
			// 새어 나가지 않게만 한다.
			flushTimer.current = setTimeout(() => {
				flush().catch(() => {});
			}, COALESCE_MS);
		};

		const unsubscribeDm = subscribeRealtime(
			DM_EVENTS_DESTINATION,
			(payload) => {
				if (!isDmRealtimeEvent(payload)) return;
				if (seenEventIds.current.has(payload.eventId)) return;
				if (seenEventIds.current.size >= SEEN_EVENT_LIMIT) {
					seenEventIds.current.clear();
				}
				seenEventIds.current.add(payload.eventId);

				// 서버는 보낸 사람에게도 MESSAGE_CREATED를 준다. 내가 보낸 건 전송
				// 뮤테이션이 이미 갱신했으므로 여기서 또 재조회하면 요청이 2배가 된다.
				if (
					payload.eventType === "MESSAGE_CREATED" &&
					payload.message?.senderSeq === myUserSeq
				) {
					return;
				}

				pendingRoomSeqs.current.add(payload.dmRoomSeq);
				if (payload.eventType === "MESSAGE_CREATED") {
					// 상대가 보낸 메시지는 NEW_DM 알림을 만든다.
					needsNotificationRefresh.current = true;
				}
				schedule();
			},
		);

		const unsubscribeNotifications = subscribeRealtime(
			NOTIFICATIONS_DESTINATION,
			() => {
				needsNotificationRefresh.current = true;
				schedule();
			},
		);

		return () => {
			unsubscribeDm();
			unsubscribeNotifications();
			if (flushTimer.current != null) {
				clearTimeout(flushTimer.current);
				flushTimer.current = null;
			}
		};
	}, [accessToken, myUserSeq, queryClient]);
}
