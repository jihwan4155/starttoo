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

/** 묶음 DM 알림을 방 단위로 모두 읽음 처리 */
async function markDmBundleByNotificationReads(
	notificationId: number,
	dmRoomId: number,
	bundledCount: number,
): Promise<void> {
	let currentId = notificationId;
	const attempts = Math.max(bundledCount, 1);

	for (let i = 0; i < attempts; i += 1) {
		await markNotificationRead(currentId);
		if (i === attempts - 1) break;

		const preview = await getUnreadPreview();
		const next = preview.items.find(
			(item) =>
				item.notificationType === "NEW_DM" &&
				item.referenceId === dmRoomId,
		);
		if (!next) break;
		currentId = next.notificationId;
	}
}

/** DM 알림 클릭 — 방 묶음 전체 읽음 */
export async function markDmNotificationRead(
	notificationId: number,
	dmRoomId: number,
	bundledCount = 1,
): Promise<void> {
	try {
		await markDmRoomRead(dmRoomId);
	} catch {
		await markDmBundleByNotificationReads(
			notificationId,
			dmRoomId,
			bundledCount,
		);
	}
}
