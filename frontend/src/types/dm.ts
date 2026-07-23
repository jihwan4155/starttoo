export type DmMessage = {
	id: number;
	/** true면 내가 보낸 메시지 */
	mine: boolean;
	content: string;
	time: string;
	/** 문의 안내처럼 강조 표시할 메시지 */
	isNotice?: boolean;
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
