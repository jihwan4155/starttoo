import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	createDmRoom,
	leaveDmRoom,
	markDmRoomRead,
	sendDmMessage,
	setDmRoomNotification,
} from "../../services/dmApi";
import { dmMessagesQueryKey } from "../queries/useDmMessages";
import { dmRoomsQueryKey } from "../queries/useDmRooms";
import type { SendDmMessageRequest } from "../../types/dm";

/** 방 목록·미확인 알림 수는 어느 변경에서도 함께 흔들린다 */
function invalidateRoomsAndBadges(
	queryClient: ReturnType<typeof useQueryClient>,
) {
	void queryClient.invalidateQueries({ queryKey: dmRoomsQueryKey });
	void queryClient.invalidateQueries({ queryKey: ["notifications"] });
}

/** POST /dm/rooms/{roomSeq}/messages */
export function useSendDmMessage() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			roomSeq,
			body,
		}: {
			roomSeq: number;
			body: SendDmMessageRequest;
		}) => sendDmMessage(roomSeq, body),
		onSuccess: (_data, { roomSeq }) => {
			void queryClient.invalidateQueries({
				queryKey: dmMessagesQueryKey(roomSeq),
			});
			invalidateRoomsAndBadges(queryClient);
		},
	});
}

/**
 * PATCH /dm/rooms/{roomSeq}/read
 *
 * 이 방의 NEW_DM 알림까지 서버가 같은 트랜잭션에서 처리하므로 알림 캐시도 비운다.
 */
export function useMarkDmRoomRead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (roomSeq: number) => markDmRoomRead(roomSeq),
		onSuccess: (_count, roomSeq) => {
			void queryClient.invalidateQueries({
				queryKey: dmMessagesQueryKey(roomSeq),
			});
			invalidateRoomsAndBadges(queryClient);
		},
	});
}

/** PATCH /dm/rooms/{roomSeq}/notification */
export function useSetDmRoomNotification() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			roomSeq,
			enabled,
		}: {
			roomSeq: number;
			enabled: boolean;
		}) => setDmRoomNotification(roomSeq, enabled),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: dmRoomsQueryKey });
		},
	});
}

/** DELETE /dm/rooms/{roomSeq} */
export function useLeaveDmRoom() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (roomSeq: number) => leaveDmRoom(roomSeq),
		onSuccess: (_ok, roomSeq) => {
			queryClient.removeQueries({ queryKey: dmMessagesQueryKey(roomSeq) });
			invalidateRoomsAndBadges(queryClient);
		},
	});
}

/** POST /dm/rooms — 프로필에서 "메시지 보내기" 등으로 방 열기 */
export function useCreateDmRoom() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (partnerSeq: number) => createDmRoom(partnerSeq),
		onSuccess: (room) => {
			void queryClient.invalidateQueries({
				queryKey: dmMessagesQueryKey(room.dmRoomSeq),
			});
			invalidateRoomsAndBadges(queryClient);
		},
	});
}
