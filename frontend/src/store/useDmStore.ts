import { create } from "zustand";
import { MOCK_DM_ROOMS } from "../mocks/dm";
import type { DmRoom } from "../types/dm";
import useNotificationStore from "./useNotificationStore";

/**
 * DM 상태 (인스타 DM처럼 동작 — 방 목록/메시지/안읽음/전송/자동응답)
 * TODO: 백엔드 연동 시 rooms는 API(GET /dm/rooms, /dm/rooms/{id}/messages)로,
 *       전송은 POST /dm/rooms/{id}/messages로 대체
 */
type DmState = {
	rooms: DmRoom[];
	/** 현재 열려 있는 방 id (열려 있으면 알림 대신 바로 대화에 표시) */
	activeRoomId: number | null;
	/** 방 열기 — 선택 + 읽음 처리 */
	openRoom: (roomId: number) => void;
	/** DM 페이지를 벗어날 때 호출 (이후 수신 메시지는 알림으로) */
	leaveDm: () => void;
	/** 방 읽음 처리 (안읽음 배지 0) */
	markRead: (roomId: number) => void;
	/** 내가 메시지 전송 — 데모용 자동응답 예약 */
	sendMessage: (roomId: number, content: string) => void;
};

/** 현재 시각을 "오전/오후 h:mm" 형식으로 */
function nowLabel(): string {
	const d = new Date();
	const h = d.getHours();
	const m = d.getMinutes();
	const period = h < 12 ? "오전" : "오후";
	const hour12 = h % 12 === 0 ? 12 : h % 12;
	return `${period} ${hour12}:${String(m).padStart(2, "0")}`;
}

let msgIdSeq = 100000;
const nextMsgId = () => (msgIdSeq += 1);

/** 데모용 상대방 자동응답 문구 (실제 백엔드 연동 시 제거) */
const AUTO_REPLIES = [
	"넵! 확인했습니다 :)",
	"좋아요, 조금만 기다려주세요~",
	"도안 시안 정리해서 보내드릴게요!",
	"부위랑 사이즈 알려주시면 상담 도와드릴게요.",
	"감사합니다! 예약 일정 조율해볼게요.",
];
let replyIdx = 0;
const pickReply = () => {
	const reply = AUTO_REPLIES[replyIdx % AUTO_REPLIES.length];
	replyIdx += 1;
	return reply;
};

const useDmStore = create<DmState>((set, get) => ({
	rooms: MOCK_DM_ROOMS,
	activeRoomId: null,

	openRoom: (roomId) => {
		set({ activeRoomId: roomId });
		get().markRead(roomId);
		// 방을 열면 해당 방 관련 알림도 읽음 처리
		useNotificationStore.getState().markRoomRead(roomId);
	},

	leaveDm: () => set({ activeRoomId: null }),

	markRead: (roomId) =>
		set((state) => ({
			rooms: state.rooms.map((r) =>
				r.id === roomId ? { ...r, unreadCount: 0 } : r,
			),
		})),

	sendMessage: (roomId, content) => {
		const time = nowLabel();
		set((state) => ({
			rooms: state.rooms.map((r) =>
				r.id === roomId
					? {
							...r,
							messages: [
								...r.messages,
								{ id: nextMsgId(), mine: true, content, time },
							],
							lastMessage: content,
							lastTime: time,
						}
					: r,
			),
		}));

		// 데모용: 상대방이 잠시 후 자동으로 답장 → 활성 방이 아니면 알림 생성
		const delay = 1400 + Math.floor(Math.random() * 1600);
		setTimeout(() => {
			const room = get().rooms.find((r) => r.id === roomId);
			if (!room) return;
			const replyTime = nowLabel();
			const reply = pickReply();
			const isActive = get().activeRoomId === roomId;

			set((state) => ({
				rooms: state.rooms.map((r) =>
					r.id === roomId
						? {
								...r,
								messages: [
									...r.messages,
									{ id: nextMsgId(), mine: false, content: reply, time: replyTime },
								],
								lastMessage: reply,
								lastTime: replyTime,
								unreadCount: isActive ? 0 : r.unreadCount + 1,
							}
						: r,
				),
			}));

			// 대화창을 보고 있지 않으면 우상단 알림 생성
			if (!isActive) {
				useNotificationStore.getState().addNotification({
					type: "dm",
					roomId,
					title: room.nickname,
					body: reply,
				});
			}
		}, delay);
	},
}));

export default useDmStore;
