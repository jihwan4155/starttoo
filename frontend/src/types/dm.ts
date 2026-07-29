export type DmMessage = {
	id: number;
	/** true면 내가 보낸 메시지 */
	mine: boolean;
	content: string;
	time: string;
	/** 문의 안내처럼 강조 표시할 메시지 */
	isNotice?: boolean;
};

/** GET /dm/rooms/{dmRoomId}/messages — 메시지 항목 */
export type DmMessageResponse = {
	dmMessageId: number;
	dmRoomId: number;
	senderId: number;
	messageType: string;
	textContent: string | null;
	imageUrl: string | null;
	readAt: string | null;
	createdAt: string;
};

/** PATCH /dm/rooms/{dmRoomId}/read */
export type DmReadRequest = {
	lastReadMessageId: number;
};

/** GET /dm/rooms — 채팅방 항목 */
export type DmRoomResponse = {
	dmRoomId: number;
	opponent: {
		userId: number;
		nickname: string;
		profileImageUrl: string | null;
		role: string;
	};
	active: boolean;
	lastMessage: DmMessageResponse | null;
	unreadCount: number;
	notificationMuted: boolean;
	lastMessageAt: string | null;
	createdAt: string;
};

// TODO: 백엔드 DM 스펙(GET /dm/rooms, /dm/rooms/{id}/messages) 확정되면 동기화
export type DmRoom = {
	id: number;
	nickname: string;
	isArtist: boolean;
	lastMessage: string;
	lastTime: string;
	unreadCount: number;
	/** 대화 상단 날짜 구분선 */
	dateLabel: string;
	messages: DmMessage[];
};
