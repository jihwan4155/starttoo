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
import exploreFeed13 from "../assets/images/explore/feed13.jpg";
import type { Post, PostAuthor, PostComment } from "../types/community";

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
	{
		id: 4,
		author: { nickname: "라인웍스", isArtist: true },
		createdAt: hoursAgo(7),
		imageUrl: exploreFeed1,
		caption:
			"손목 미니멀 레터링. 얇은 선으로 오래 봐도 질리지 않게 작업했어요 🖤 문의는 DM으로!",
		likeCount: 356,
		commentCount: 2,
		comments: [
			{
				id: 41,
				author: { nickname: "소소경", isArtist: false },
				content: "폰트 너무 예뻐요! 커스텀 가능한가요?",
				createdAt: hoursAgo(5),
				likeCount: 7,
			},
			{
				id: 42,
				author: { nickname: "라인웍스", isArtist: true },
				content: "네! 원하시는 문구로 도안 잡아드려요 :)",
				createdAt: hoursAgo(4),
				likeCount: 3,
			},
		],
	},
	{
		id: 5,
		author: { nickname: "감성타투_무이", isArtist: true },
		createdAt: hoursAgo(11),
		imageUrl: exploreFeed3,
		caption: "발목 미니 플라워 🌷 봄 느낌 나게 은은한 톤으로 채색했어요.",
		likeCount: 289,
		commentCount: 1,
		comments: [
			{
				id: 51,
				author: { nickname: "니들노노 레이니", isArtist: false },
				content: "색감 진짜 취향이에요 ㅠㅠ 유지력도 궁금해요!",
				createdAt: hoursAgo(9),
				likeCount: 5,
			},
		],
	},
	{
		id: 6,
		author: { nickname: "블랙워크덕후", isArtist: true },
		createdAt: hoursAgo(30),
		imageUrl: exploreFeed2,
		caption: "종아리 블랙워크. 면을 꽉 채워 존재감 있게 표현했습니다.",
		likeCount: 612,
		commentCount: 1,
		comments: [
			{
				id: 61,
				author: { nickname: "수제비", isArtist: false },
				content: "면 채움 미쳤다... 세션 얼마나 걸렸어요?",
				createdAt: hoursAgo(26),
				likeCount: 15,
			},
		],
	},
];

/** 탐색 그리드용 게시글 원본 데이터 (이미지 + 게시글 정보) */
const EXPLORE_SEED: {
	imageUrl: string;
	author: PostAuthor;
	caption: string;
	likeCount: number;
	comments: PostComment[];
}[] = [
	{
		imageUrl: exploreFeed13,
		author: { nickname: "김타투이스트!", isArtist: true },
		caption:
			"센티넬 로봇에 고양이 파일럿 태워봤어요 🤖🐱 컬러 채도 살리면서 메탈 질감 표현에 신경 쓴 작업물입니다!",
		likeCount: 421,
		comments: [
			{
				id: 1131,
				author: { nickname: "니들노노 레이니", isArtist: false },
				content: "고양이 너무 귀여워요 ㅠㅠ 색감 미쳤다..",
				createdAt: hoursAgo(2),
				likeCount: 12,
			},
		],
	},
	{
		imageUrl: exploreFeed1,
		author: { nickname: "라인웍스", isArtist: true },
		caption: "손목 라인 미니멀 레터링. 얇은 선으로 오래 봐도 질리지 않게 작업했어요 🖤",
		likeCount: 312,
		comments: [
			{
				id: 1101,
				author: { nickname: "수제비", isArtist: false },
				content: "선 정말 깔끔하네요! 유지력은 어떤가요?",
				createdAt: hoursAgo(4),
				likeCount: 6,
			},
		],
	},
	{
		imageUrl: exploreFeed2,
		author: { nickname: "블랙워크덕후", isArtist: true },
		caption: "종아리 블랙워크. 면을 꽉 채워서 존재감 있게 표현했습니다.",
		likeCount: 528,
		comments: [
			{
				id: 1201,
				author: { nickname: "소소경", isArtist: false },
				content: "면 채움 미쳤다... 시간 얼마나 걸렸어요?",
				createdAt: hoursAgo(6),
				likeCount: 14,
			},
		],
	},
	{
		imageUrl: exploreFeed3,
		author: { nickname: "감성타투_무이", isArtist: true },
		caption: "발목 미니 플라워. 봄 느낌 나게 은은한 톤으로 🌷",
		likeCount: 274,
		comments: [],
	},
	{
		imageUrl: exploreFeed4,
		author: { nickname: "잉크스튜디오", isArtist: true },
		caption: "팔뚝 블랙&그레이 그림자 작업. 커버업 상담 환영합니다.",
		likeCount: 733,
		comments: [
			{
				id: 1401,
				author: { nickname: "니들노노 레이니", isArtist: false },
				content: "그라데이션이 자연스러워요. 도안 문의 드려요!",
				createdAt: hoursAgo(8),
				likeCount: 9,
			},
		],
	},
	{
		imageUrl: exploreFeed5,
		author: { nickname: "타투아티스트 레이디", isArtist: true },
		caption: "등 라인 대형 작업. 척추 라인을 따라 흐르게 구성했어요.",
		likeCount: 1024,
		comments: [
			{
				id: 1501,
				author: { nickname: "블랙워크덕후", isArtist: false },
				content: "스케일 대박이네요 👏",
				createdAt: hoursAgo(10),
				likeCount: 21,
			},
		],
	},
	{
		imageUrl: exploreFeed6,
		author: { nickname: "라인웍스", isArtist: true },
		caption: "쇄골 레터링 클로즈업. 폰트는 손글씨 기반으로 커스텀했습니다.",
		likeCount: 389,
		comments: [],
	},
	{
		imageUrl: exploreFeed7,
		author: { nickname: "무채색스튜디오", isArtist: true },
		caption: "손등 미니 심볼. 작지만 포인트로 딱이에요 ✨",
		likeCount: 205,
		comments: [
			{
				id: 1701,
				author: { nickname: "수제비", isArtist: false },
				content: "위치 고민 중이었는데 참고할게요!",
				createdAt: hoursAgo(5),
				likeCount: 3,
			},
		],
	},
	{
		imageUrl: exploreFeed8,
		author: { nickname: "잉크스튜디오", isArtist: true },
		caption: "허벅지 대형 블랙워크. 하루 세션으로 마무리했습니다.",
		likeCount: 866,
		comments: [],
	},
	{
		imageUrl: exploreFeed9,
		author: { nickname: "감성타투_무이", isArtist: true },
		caption: "귀 뒤 미니 별. 시크릿 타투로 인기 많은 자리예요 ⭐",
		likeCount: 178,
		comments: [
			{
				id: 1901,
				author: { nickname: "소소경", isArtist: false },
				content: "너무 귀여워요! 통증은요?",
				createdAt: hoursAgo(3),
				likeCount: 4,
			},
		],
	},
	{
		imageUrl: exploreFeed10,
		author: { nickname: "무채색스튜디오", isArtist: true },
		caption: "목 뒤 레터링. 옷깃에 살짝 가려지는 위치라 부담 없어요.",
		likeCount: 451,
		comments: [],
	},
	{
		imageUrl: exploreFeed11,
		author: { nickname: "블랙워크덕후", isArtist: true },
		caption: "팔 전체 슬리브 진행 중. 다음 세션에서 명암 넣을 예정입니다.",
		likeCount: 692,
		comments: [
			{
				id: 11101,
				author: { nickname: "니들노노 레이니", isArtist: false },
				content: "완성 너무 기대돼요!",
				createdAt: hoursAgo(7),
				likeCount: 8,
			},
		],
	},
	{
		imageUrl: exploreFeed12,
		author: { nickname: "타투아티스트 레이디", isArtist: true },
		caption: "손가락 미니 라인. 커플 타투로도 인기 많아요 🤍",
		likeCount: 340,
		comments: [],
	},
];

/** 탐색 그리드 게시글 — id 100번대로 피드 게시글과 구분 */
export const MOCK_EXPLORE_POSTS: Post[] = EXPLORE_SEED.map((seed, index) => ({
	id: 100 + index + 1,
	author: seed.author,
	createdAt: hoursAgo(index + 1),
	imageUrl: seed.imageUrl,
	caption: seed.caption,
	likeCount: seed.likeCount,
	commentCount: seed.comments.length,
	comments: seed.comments,
}));

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
