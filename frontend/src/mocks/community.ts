import heroImage from "../assets/images/hero-rosalia.png";
import demoTattoo from "../assets/images/demo-tattoo.png";
import exploreFeed1 from "../assets/images/explore/feed1.jpg";
import exploreFeed2 from "../assets/images/explore/feed2.jpg";
import exploreFeed3 from "../assets/images/explore/feed3.jpg";
import exploreFeed4 from "../assets/images/explore/feed4.jpg";
import exploreFeed5 from "../assets/images/explore/feed5.jpg";
import exploreFeed6 from "../assets/images/explore/feed6.jpg";
import exploreFeed7 from "../assets/images/explore/feed7.jpg";
import exploreFeed8 from "../assets/images/explore/feed8.jpg";
import exploreFeed9 from "../assets/images/explore/feed9.jpg";
import exploreFeed10 from "../assets/images/explore/feed10.jpg";
import exploreFeed11 from "../assets/images/explore/feed11.jpg";
import exploreFeed12 from "../assets/images/explore/feed12.jpg";
import type { Post } from "../types/community";

/** n시간 전 ISO 문자열 (목업용) */
const hoursAgo = (hours: number) =>
	new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

/** 시연용 목업 데이터 — 백엔드 연동 시 API 응답으로 교체 */
export const MOCK_POSTS: Post[] = [
	{
		id: 1,
		author: { nickname: "타투아티스트 레이디", isArtist: true },
		createdAt: hoursAgo(3),
		imageUrl: heroImage,
		caption:
			"쇄골 라인을 따라 흐르는 레터링 작업입니다. 가늘고 섬세한 선으로 부담스럽지 않게 표현했어요 ✨",
		likeCount: 684,
		commentCount: 23,
		comments: [
			{
				id: 11,
				author: { nickname: "니들노노 레이니", isArtist: false },
				content: "라인이 진짜 깔끔하네요! 도안 문의 드려도 될까요?",
				createdAt: hoursAgo(2),
				likeCount: 12,
				replies: [
					{
						id: 111,
						author: { nickname: "타투아티스트 레이디", isArtist: true },
						content: "감사합니다! DM으로 편하게 문의주세요 :)",
						createdAt: hoursAgo(1),
						likeCount: 3,
					},
				],
			},
			{
				id: 12,
				author: { nickname: "수제비", isArtist: false },
				content: "저도 이 위치에 하고 싶었는데 참고할게요!",
				createdAt: hoursAgo(1),
				likeCount: 5,
			},
			{
				id: 13,
				author: { nickname: "소소경", isArtist: false },
				content: "톤이 너무 예뻐요. 통증은 어느 정도였나요?",
				createdAt: hoursAgo(0.7),
				likeCount: 2,
			},
		],
	},
	{
		id: 2,
		author: { nickname: "타투아티스트 레이디", isArtist: true },
		createdAt: hoursAgo(5),
		imageUrl: heroImage,
		caption: "어깨 라인 미니 플라워. 흑백으로 은은하게 🌸",
		likeCount: 402,
		commentCount: 8,
		comments: [
			{
				id: 21,
				author: { nickname: "블랙워크덕후", isArtist: false },
				content: "미니인데 존재감 있네요!",
				createdAt: hoursAgo(3),
				likeCount: 4,
			},
		],
	},
	{
		id: 3,
		author: { nickname: "잉크스튜디오", isArtist: true },
		createdAt: hoursAgo(24),
		imageUrl: demoTattoo,
		caption: "블랙&그레이 스컬 작업. 커버업 문의 환영합니다.",
		likeCount: 951,
		commentCount: 31,
		comments: [
			{
				id: 31,
				author: { nickname: "수제비", isArtist: false },
				content: "디테일 미쳤다...",
				createdAt: hoursAgo(20),
				likeCount: 18,
			},
		],
	},
];

/** 탐색 그리드 — null은 회색 플레이스홀더 */
export const MOCK_EXPLORE_IMAGES: (string | null)[] = [
	exploreFeed1,
	exploreFeed2,
	exploreFeed3,
	exploreFeed4,
	exploreFeed5,
	exploreFeed6,
	exploreFeed7,
	exploreFeed8,
	exploreFeed9,
	exploreFeed10,
	exploreFeed11,
	exploreFeed12,
];

export const MOCK_CATEGORIES = [
	"감성타투",
	"레터링",
	"미니타투",
	"블랙워크",
];

export const MOCK_RECENT_SEARCHES = [
	"쇄골 레터링",
	"커버업",
	"블랙 앤 그레이",
];

export const MOCK_SUGGESTIONS = [
	"black and white",
	"blackwork",
	"black & grey",
	"블랙워크",
	"블랙 미니타투",
];
