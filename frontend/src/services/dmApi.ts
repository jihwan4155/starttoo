import { api } from "./api";
import type { CursorPage } from "../types/community";
import type {
	CreateDmRoomRequest,
	DmMessageResponse,
	DmNotificationSettingRequest,
	DmPageQuery,
	DmRoomResponse,
	SendDmMessageRequest,
} from "../types/dm";

/** GET /dm/rooms — 내 활성 채팅방 목록 (최신 메시지 시각·dmRoomSeq 내림차순) */
export async function fetchDmRooms(
	params?: DmPageQuery,
): Promise<CursorPage<DmRoomResponse>> {
	const { data } = await api.get<CursorPage<DmRoomResponse>>("/dm/rooms", {
		params,
	});
	return data;
}

/**
 * POST /dm/rooms — 1대1 방 생성 또는 재활성화
 *
 * 같은 두 회원 사이에는 방이 하나만 존재한다. 기존 방이면 새로 만들지 않고
 * 내 참여 상태만 활성화한다. 서버가 이 호출을 "채팅방 진입"으로 보고 상대
 * 메시지와 이 방의 NEW_DM 알림까지 함께 읽음 처리하므로 별도 read 호출이 필요 없다.
 */
export async function createDmRoom(partnerSeq: number): Promise<DmRoomResponse> {
	const body: CreateDmRoomRequest = { partnerSeq };
	const { data } = await api.post<DmRoomResponse>("/dm/rooms", body);
	return data;
}

/**
 * GET /dm/rooms/{roomSeq}/messages — 과거 메시지
 *
 * dmMessageSeq 내림차순이라 items는 최신이 먼저다. 화면에 시간순으로 그리려면
 * 뒤집어야 한다. 방을 나갈 때 기록된 숨김 기준 이전 메시지는 내려오지 않는다.
 */
export async function fetchDmMessages(
	roomSeq: number,
	params?: DmPageQuery,
): Promise<CursorPage<DmMessageResponse>> {
	const { data } = await api.get<CursorPage<DmMessageResponse>>(
		`/dm/rooms/${roomSeq}/messages`,
		{ params },
	);
	return data;
}

/** POST /dm/rooms/{roomSeq}/messages — 텍스트·이미지 중 최소 하나 필요 */
export async function sendDmMessage(
	roomSeq: number,
	body: SendDmMessageRequest,
): Promise<DmMessageResponse> {
	const { data } = await api.post<DmMessageResponse>(
		`/dm/rooms/${roomSeq}/messages`,
		body,
	);
	return data;
}

/**
 * PATCH /dm/rooms/{roomSeq}/read — 상대방 메시지 일괄 읽음
 *
 * 요청 본문은 없다. 같은 트랜잭션에서 이 방의 NEW_DM 미읽음 알림도 함께 읽음
 * 처리하므로, DM 알림을 읽는 경로도 이 호출 하나로 끝난다.
 * 응답은 실제로 읽음 처리된 메시지 수.
 */
export async function markDmRoomRead(roomSeq: number): Promise<number> {
	const { data } = await api.patch<number>(`/dm/rooms/${roomSeq}/read`);
	return data;
}

/** PATCH /dm/rooms/{roomSeq}/notification — 방별 알림 on·off */
export async function setDmRoomNotification(
	roomSeq: number,
	enabled: boolean,
): Promise<boolean> {
	const body: DmNotificationSettingRequest = { enabled };
	const { data } = await api.patch<boolean>(
		`/dm/rooms/${roomSeq}/notification`,
		body,
	);
	return data;
}

/**
 * DELETE /dm/rooms/{roomSeq} — 채팅방 나가기
 *
 * 방과 메시지는 남는다. 현재 마지막 메시지를 숨김 기준으로 저장하고 내 참여만
 * 비활성화하므로, 새 메시지가 오면 방은 다시 보이지만 이전 대화는 보이지 않는다.
 */
export async function leaveDmRoom(roomSeq: number): Promise<boolean> {
	const { data } = await api.delete<boolean>(`/dm/rooms/${roomSeq}`);
	return data;
}
