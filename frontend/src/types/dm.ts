/**
 * 백엔드 DM 도메인 타입
 * 기준: https://starttoo.duckdns.org/v3/api-docs (2026-08-03 확인)
 *
 * 응답 필드명이 그대로 화면에서 쓸 만한 모양이라 별도 UI 타입·매퍼를 두지 않는다.
 * "내 메시지인지"와 시각 표기는 조회 시점 파생값이므로 화면에서 계산한다.
 */

export type DmMessageType = "TEXT" | "IMAGE" | "TEXT_WITH_IMAGE";

/** RoomResponse.partner — 상대 프로필 요약 (role은 내려오지 않는다) */
export type DmPartner = {
	userSeq: number;
	nickname: string;
	profileImageSeq: number | null;
	/** 단기 Presigned GET URL */
	profileImageUrl: string | null;
	/**
	 * role=ARTIST이고 인증까지 끝난 상대인지.
	 *
	 * role은 안 내려오지만 이 값이 그 판정을 대신한다 — 서버가 role과
	 * verificationStatus를 함께 보고 계산해 준다.
	 */
	verified: boolean;
};

/** GET·POST /dm/rooms — 채팅방 (Swagger RoomResponse) */
export type DmRoomResponse = {
	dmRoomSeq: number;
	partner: DmPartner;
	/** 내가 나가지 않은 방인지 */
	active: boolean;
	/** 이 방의 푸시 알림 수신 여부 */
	notificationEnabled: boolean;
	/** 방을 나가기 전 숨김 기준 이후의 미읽음 수 */
	unreadCount: number;
	lastMessagePreview: string | null;
	lastMessageDttm: string | null;
};

/** GET·POST /dm/rooms/{roomSeq}/messages — 메시지 (Swagger MessageResponse) */
export type DmMessageResponse = {
	dmMessageSeq: number;
	dmRoomSeq: number;
	senderSeq: number;
	messageType: DmMessageType;
	/** 삭제된 메시지는 본문·이미지가 모두 null이고 deleted=true */
	textContent: string | null;
	imageSeq: number | null;
	/** 단기 Presigned GET URL */
	imageUrl: string | null;
	readDttm: string | null;
	deleted: boolean;
	regDttm: string;
};

/** POST /dm/rooms */
export type CreateDmRoomRequest = {
	partnerSeq: number;
};

/** POST /dm/rooms/{roomSeq}/messages — 텍스트·이미지 중 최소 하나 */
export type SendDmMessageRequest = {
	/** 최대 4000자 */
	textContent?: string;
	/** 본인이 DM 목적으로 업로드한 활성 이미지 seq */
	imageSeq?: number;
};

/** PATCH /dm/rooms/{roomSeq}/notification */
export type DmNotificationSettingRequest = {
	enabled: boolean;
};

/** 커서 페이지 쿼리 — 방 목록·메시지 공통 */
export type DmPageQuery = {
	cursor?: string;
	size?: number;
};

export type DmRealtimeEventType = "MESSAGE_CREATED" | "MESSAGES_READ";

/**
 * STOMP `/user/queue/dm-events` 페이로드 (Swagger 밖 — DmDtos.RealtimeEvent)
 *
 * MESSAGE_CREATED면 message가, MESSAGES_READ면 readerSeq·readDttm·
 * changedMessageCount가 채워진다. eventId는 재연결·중복 수신을 걸러내기 위한 값이다.
 */
export type DmRealtimeEvent = {
	eventId: string;
	eventType: DmRealtimeEventType;
	dmRoomSeq: number;
	message: DmMessageResponse | null;
	readerSeq: number | null;
	readDttm: string | null;
	changedMessageCount: number | null;
	occurredDttm: string;
};
