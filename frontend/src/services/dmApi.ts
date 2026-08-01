import { api } from "./api";
import type { CursorPage } from "../types/community";
import type {
	DmMessageResponse,
	DmReadRequest,
	DmRoomResponse,
} from "../types/dm";
import {
	getUnreadPreview,
	markNotificationRead,
} from "./notificationApi";

/** GET /dm/rooms — 방 목록에서 최신 메시지 ID 조회 */
async function getLatestMessageIdFromRooms(
	dmRoomId: number,
): Promise<number | null> {
	const { data } = await api.get<CursorPage<DmRoomResponse>>("/dm/rooms", {
		params: { size: 50 },
	});
	return (
		data.items.find((room) => room.dmRoomId === dmRoomId)?.lastMessage
			?.dmMessageId ?? null
	);
}

/** GET /dm/rooms/{dmRoomId}/messages — 최신 메시지 1건 조회 */
async function getLatestMessageIdFromMessages(
	dmRoomId: number,
): Promise<number | null> {
	const { data } = await api.get<CursorPage<DmMessageResponse>>(
		`/dm/rooms/${dmRoomId}/messages`,
		{ params: { size: 1 } },
	);
	return data.items.at(-1)?.dmMessageId ?? null;
}

async function resolveLatestMessageId(dmRoomId: number): Promise<number> {
	const fromRooms = await getLatestMessageIdFromRooms(dmRoomId);
	if (fromRooms != null) return fromRooms;

	const fromMessages = await getLatestMessageIdFromMessages(dmRoomId);
	if (fromMessages != null) return fromMessages;

	throw new Error("DM_ROOM_HAS_NO_MESSAGES");
}

/**
 * DM 방 알림 전체 읽음 — PATCH /dm/rooms/{id}/read
 * (notificationService.readRoom 호출로 해당 방 NEW_DM 알림 일괄 처리)
 */
export async function markDmRoomRead(dmRoomId: number): Promise<void> {
	const lastReadMessageId = await resolveLatestMessageId(dmRoomId);
	const body: DmReadRequest = { lastReadMessageId };
	await api.patch(`/dm/rooms/${dmRoomId}/read`, body);
}

/**
 * 방 단위 읽음이 막혔을 때의 우회 상한.
 *
 * 알림은 메시지당 한 행이라 방에 몇 건이 남아 있는지 미리 알 수 없다.
 * 남은 알림이 없으면 루프가 스스로 끝나고, 이 값은 폭주만 막는 안전장치다.
 */
const MAX_DM_BUNDLE_ATTEMPTS = 20;

/** 같은 방의 NEW_DM 알림을 하나씩 읽음 처리 */
async function markDmBundleByNotificationReads(
	notificationSeq: number,
	dmRoomId: number,
): Promise<void> {
	let currentSeq: number | null = notificationSeq;

	for (let i = 0; i < MAX_DM_BUNDLE_ATTEMPTS && currentSeq != null; i += 1) {
		await markNotificationRead(currentSeq);

		const preview = await getUnreadPreview();
		currentSeq =
			preview.items.find(
				(item) =>
					item.notificationType === "NEW_DM" &&
					item.referenceSeq === dmRoomId,
			)?.notificationSeq ?? null;
	}
}

/** DM 알림 클릭 — 방의 미확인 알림 전체 읽음 */
export async function markDmNotificationRead(
	notificationSeq: number,
	dmRoomId: number,
): Promise<void> {
	try {
		await markDmRoomRead(dmRoomId);
	} catch {
		await markDmBundleByNotificationReads(notificationSeq, dmRoomId);
	}
}
