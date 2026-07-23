import type { Artist } from "../types/artist";
import { MOCK_EXPLORE_POSTS } from "./community";

/** 탐색 게시글에서 해당 닉네임 작성자의 이미지들을 모아 작업물 미리보기로 사용 */
const worksOf = (nickname: string): string[] =>
	MOCK_EXPLORE_POSTS.filter((post) => post.author.nickname === nickname)
		.map((post) => post.imageUrl)
		.filter((url): url is string => !!url);

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
		imageUrls: worksOf("김타투이스트!"),
	},
	{
		id: 2,
		name: "잉크스튜디오",
		isOpen: true,
		hoursLabel: "21:00에 영업 종료",
		distanceKm: 3.8,
		address: "서울 서대문구 연세로 12길 5 2층",
		categories: ["커버업", "블랙앤그레이", "이레즈미"],
		imageUrls: worksOf("잉크스튜디오"),
	},
	{
		id: 3,
		name: "타투아티스트 레이디",
		isOpen: false,
		hoursLabel: "11:00에 영업 시작",
		distanceKm: 8.4,
		address: "서울 강남구 도산대로 15길 22 지하 1층",
		categories: ["수채화", "꽃타투", "감성타투"],
		imageUrls: worksOf("타투아티스트 레이디"),
	},
	{
		id: 4,
		name: "라인웍스",
		isOpen: true,
		hoursLabel: "20:00에 영업 종료",
		distanceKm: 2.5,
		address: "서울 마포구 양화로 23길 8 3층",
		categories: ["레터링", "라인워크", "미니타투"],
		imageUrls: worksOf("라인웍스"),
	},
	{
		id: 5,
		name: "블랙워크덕후",
		isOpen: true,
		hoursLabel: "22:30에 영업 종료",
		distanceKm: 5.1,
		address: "서울 용산구 이태원로 27길 40 2층",
		categories: ["블랙워크", "이레즈미", "커버업"],
		imageUrls: worksOf("블랙워크덕후"),
	},
	{
		id: 6,
		name: "감성타투_무이",
		isOpen: false,
		hoursLabel: "12:00에 영업 시작",
		distanceKm: 6.7,
		address: "서울 성동구 왕십리로 10길 15 1층",
		categories: ["감성타투", "꽃타투", "미니타투"],
		imageUrls: worksOf("감성타투_무이"),
	},
	{
		id: 7,
		name: "무채색스튜디오",
		isOpen: true,
		hoursLabel: "21:30에 영업 종료",
		distanceKm: 4.3,
		address: "서울 종로구 자하문로 12길 6 2층",
		categories: ["블랙앤그레이", "레터링", "미니타투"],
		imageUrls: worksOf("무채색스튜디오"),
	},
];
