import type { Artist } from "../types/artist";

/** 시연용 타투이스트 목업 데이터 — 백엔드 연동 시 API 응답으로 교체 */
export const MOCK_ARTISTS: Artist[] = [
	{
		id: 1,
		name: "김타투이스트!",
		isOpen: true,
		hoursLabel: "22:00에 영업 종료",
		distanceKm: 1.2,
		address: "서울 마포구 와우산로 39-14 1층",
		categories: ["레터링", "미니타투", "라인워크"],
		imageUrls: [],
	},
	{
		id: 2,
		name: "잉크스튜디오",
		isOpen: true,
		hoursLabel: "21:00에 영업 종료",
		distanceKm: 3.8,
		address: "서울 서대문구 연세로 12길 5 2층",
		categories: ["커버업", "블랙앤그레이", "이레즈미"],
		imageUrls: [],
	},
	{
		id: 3,
		name: "타투아티스트 레이디",
		isOpen: false,
		hoursLabel: "11:00에 영업 시작",
		distanceKm: 8.4,
		address: "서울 강남구 도산대로 15길 22 지하 1층",
		categories: ["수채화", "꽃타투", "감성타투"],
		imageUrls: [],
	},
];
