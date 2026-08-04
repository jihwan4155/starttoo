import defaultProfile from "../assets/images/default-profile.png";
import feed1 from "../assets/images/explore/feed1.jpg";
import feed2 from "../assets/images/explore/feed2.jpg";
import feed3 from "../assets/images/explore/feed3.jpg";
import feed4 from "../assets/images/explore/feed4.jpg";
import feed5 from "../assets/images/explore/feed5.jpg";
import feed6 from "../assets/images/explore/feed6.jpg";
import feed7 from "../assets/images/explore/feed7.jpg";
import feed8 from "../assets/images/explore/feed8.jpg";
import feed9 from "../assets/images/explore/feed9.jpg";
import feed10 from "../assets/images/explore/feed10.jpg";
import feed11 from "../assets/images/explore/feed11.jpg";
import feed12 from "../assets/images/explore/feed12.jpg";
import feed13 from "../assets/images/explore/feed13.jpg";
import type { Artist } from "../types/artist";
import type { Post } from "../types/community";

export const mockFeedImages = [feed1, feed2, feed3, feed4, feed5, feed6, feed7, feed8, feed9, feed10, feed11, feed12, feed13];

const names = ["백두산 호랑이", "스누피", "모노라인", "잉크가든", "서울바늘"];
const captions = [
	"오늘 작업한 플라워 라인 타투입니다. 작은 디테일까지 천천히 완성했어요.",
	"블랙워크와 얇은 선을 섞은 커스텀 도안. 예약 문의는 프로필을 확인해주세요.",
	"오래 고민한 첫 타투를 함께 완성했습니다 ✨",
	"빈티지한 무드의 미니 타투 작업 기록입니다.",
	"각자의 이야기가 자연스럽게 담기는 도안을 만들어요.",
];

export const mockPosts: Post[] = mockFeedImages.map((imageUrl, index) => ({
	id: 9000 + index,
	author: {
		userId: 700 + (index % names.length),
		nickname: names[index % names.length],
		isArtist: index % 3 !== 1,
		avatarUrl: defaultProfile,
	},
	createdAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString(),
	imageUrl,
	imageUrls: [imageUrl],
	caption: captions[index % captions.length],
	likeCount: 128 + index * 57,
	commentCount: 8 + index * 3,
	liked: index === 1,
	bookmarked: index === 2,
	comments: [],
}));

/** 기존 목업 모듈과의 호환 이름 */
export const MOCK_EXPLORE_POSTS = mockPosts;

export const mockArtists: Artist[] = [
	{
		id: 9701,
		name: "백두산 호랑이",
		isOpen: true,
		hoursLabel: "오늘 21:00까지 작업해요",
		distanceKm: 1.2,
		address: "서울 마포구 연남동",
		categories: ["블랙워크", "라인워크"],
		avatarUrl: defaultProfile,
		imageUrls: [feed1, feed2, feed3, feed4],
	},
	{
		id: 9702,
		name: "모노라인 스튜디오",
		isOpen: true,
		hoursLabel: "예약제 · 11:00–20:00",
		distanceKm: 2.8,
		address: "서울 성동구 성수동",
		categories: ["미니타투", "레터링"],
		avatarUrl: defaultProfile,
		imageUrls: [feed5, feed6, feed7, feed8],
	},
	{
		id: 9703,
		name: "잉크가든",
		isOpen: false,
		hoursLabel: "내일 12:00 오픈",
		distanceKm: 4.1,
		address: "서울 용산구 한남동",
		categories: ["플라워", "컬러"],
		avatarUrl: defaultProfile,
		imageUrls: [feed9, feed10, feed11, feed12],
	},
];
