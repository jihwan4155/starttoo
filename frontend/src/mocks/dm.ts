import type { DmRoom } from "../types/dm";

/** 시연용 DM 목업 데이터 — 백엔드 연동 시 API 응답으로 교체 */
export const MOCK_DM_ROOMS: DmRoom[] = [
	{
		id: 1,
		nickname: "김타투이스트!",
		isArtist: true,
		lastMessage: "네! 도안 시안 보내드릴게요 :)",
		lastTime: "오후 2:41",
		unreadCount: 2,
		dateLabel: "3월 15일",
		messages: [
			{
				id: 11,
				mine: false,
				content:
					"안녕하세요! 문의 주셔서 감사합니다. 원하시는 도안과 부위, 사이즈를 알려주시면 상담 도와드릴게요.",
				time: "오후 2:10",
				isNotice: true,
			},
			{
				id: 12,
				mine: true,
				content: "안녕하세요, 쇄골 라인에 레터링 타투 문의드립니다!",
				time: "오후 2:32",
			},
			{
				id: 13,
				mine: false,
				content: "네! 도안 시안 보내드릴게요 :)",
				time: "오후 2:41",
			},
		],
	},
	{
		id: 2,
		nickname: "잉크스튜디오",
		isArtist: true,
		lastMessage: "커버업 상담은 사진 먼저 부탁드려요.",
		lastTime: "오전 11:05",
		unreadCount: 1,
		dateLabel: "3월 14일",
		messages: [
			{
				id: 21,
				mine: false,
				content: "커버업 상담은 사진 먼저 부탁드려요.",
				time: "오전 11:05",
			},
		],
	},
	{
		id: 3,
		nickname: "니들노노 레이니",
		isArtist: false,
		lastMessage: "저도 그 도안 너무 예쁘더라구요!",
		lastTime: "3월 12일",
		unreadCount: 0,
		dateLabel: "3월 12일",
		messages: [
			{
				id: 31,
				mine: true,
				content: "피드에 올리신 도안 정보 여쭤봐도 될까요?",
				time: "오후 7:20",
			},
			{
				id: 32,
				mine: false,
				content: "저도 그 도안 너무 예쁘더라구요!",
				time: "오후 7:45",
			},
		],
	},
];
