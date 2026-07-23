import { create } from "zustand";
import { MOCK_DM_ROOMS } from "../mocks/dm";

/**
 * 우상단 알림(벨) 상태
 * TODO: 백엔드 연동 시 알림 목록은 API(GET /notifications)로 대체
 */
export type AppNotification = {
	id: number;
	/** 현재는 DM 알림만 존재 — 추후 좋아요/댓글 등 확장 */
	type: "dm";
	/** 클릭 시 이동할 DM 방 id */
	roomId: number;
	/** 알림 제목(보낸 사람 닉네임) */
	title: string;
	/** 알림 본문(메시지 미리보기) */
	body: string;
	time: string;
	read: boolean;
};

type NotificationState = {
	notifications: AppNotification[];
	/** 새 알림 추가(최신순으로 맨 위에) */
	addNotification: (n: {
		type: "dm";
		roomId: number;
		title: string;
		body: string;
		time?: string;
	}) => void;
	/** 특정 알림 읽음 처리 */
	markRead: (id: number) => void;
	/** 특정 DM 방과 관련된 알림 모두 읽음 처리 */
	markRoomRead: (roomId: number) => void;
	/** 전체 읽음 처리 */
	markAllRead: () => void;
};

// 시연용 초기 알림 — 안읽은 DM이 있는 방을 알림으로 미리 채워둔다
const SEED_NOTIFICATIONS: AppNotification[] = MOCK_DM_ROOMS.filter(
	(room) => room.unreadCount > 0,
).map((room) => ({
	id: 1000 + room.id,
	type: "dm" as const,
	roomId: room.id,
	title: room.nickname,
	body: room.lastMessage,
	time: room.lastTime,
	read: false,
}));

let notifIdSeq = 2000;
const nextNotifId = () => (notifIdSeq += 1);

const useNotificationStore = create<NotificationState>((set) => ({
	notifications: SEED_NOTIFICATIONS,
	addNotification: ({ type, roomId, title, body, time }) =>
		set((state) => ({
			notifications: [
				{
					id: nextNotifId(),
					type,
					roomId,
					title,
					body,
					time: time ?? "방금",
					read: false,
				},
				...state.notifications,
			],
		})),
	markRead: (id) =>
		set((state) => ({
			notifications: state.notifications.map((n) =>
				n.id === id ? { ...n, read: true } : n,
			),
		})),
	markRoomRead: (roomId) =>
		set((state) => ({
			notifications: state.notifications.map((n) =>
				n.roomId === roomId ? { ...n, read: true } : n,
			),
		})),
	markAllRead: () =>
		set((state) => ({
			notifications: state.notifications.map((n) => ({ ...n, read: true })),
		})),
}));

export default useNotificationStore;
