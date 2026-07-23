import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MOCK_DM_ROOMS } from "../../mocks/dm";
import useDmStore from "../../store/useDmStore";

type NavItem = {
	id: string;
	label: string;
	to: string;
	icon:
		| "home"
		| "ai"
		| "sim"
		| "cover"
		| "community"
		| "search"
		| "dm"
		| "artist";
	/** true면 경로가 정확히 일치할 때만 활성화 (하위 경로 제외) */
	exact?: boolean;
};

const MAIN_ITEMS: NavItem[] = [
	{ id: "home", label: "홈", to: "/", icon: "home", exact: true },
	{ id: "ai", label: "AI 도안 생성", to: "/ai", icon: "ai" },
	{ id: "sim", label: "타투 시뮬레이션", to: "/simulations", icon: "sim" },
	{ id: "cover", label: "커버업 타투", to: "/coverups", icon: "cover" },
];

// 커뮤니티 그룹: 평소엔 커뮤니티 아이콘만 보이고,
// 호버하거나 커뮤니티 관련 페이지에 있을 때 하위 아이콘(검색, DM)이 펼쳐진다
const COMMUNITY_ITEMS: NavItem[] = [
	{
		id: "community",
		label: "커뮤니티",
		to: "/posts",
		icon: "community",
		exact: true,
	},
	{ id: "search", label: "피드 검색", to: "/posts/search", icon: "search" },
	{ id: "dm", label: "DM", to: "/dm", icon: "dm" },
	{ id: "artist", label: "타투이스트", to: "/artists", icon: "artist" },
];

function NavIcon({ type, active }: { type: NavItem["icon"]; active: boolean }) {
	const color = active ? "#FF0004" : "#1A1A1A";

	switch (type) {
		case "home":
			return (
				<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
					<path
						d="M4.5 12 14 4l9.5 8v10.5a1.5 1.5 0 0 1-1.5 1.5h-5.5v-7.5h-5V24H6a1.5 1.5 0 0 1-1.5-1.5V12Z"
						stroke={color}
						strokeWidth="2"
						strokeLinejoin="round"
					/>
				</svg>
			);
		case "ai":
			return (
				<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
					<path
						d="M14 3.5 15.8 10.2 22.5 12 15.8 13.8 14 20.5 12.2 13.8 5.5 12 12.2 10.2 14 3.5Z"
						fill={color}
					/>
					<path
						d="M22 17.5 22.9 20.6 26 21.5 22.9 22.4 22 25.5 21.1 22.4 18 21.5 21.1 20.6 22 17.5Z"
						fill={color}
					/>
				</svg>
			);
		case "sim":
			return (
				<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
					<rect
						x="4"
						y="7"
						width="20"
						height="14"
						rx="3"
						stroke={color}
						strokeWidth="2"
					/>
					<circle cx="14" cy="14" r="4" stroke={color} strokeWidth="2" />
					<path d="M10 7 11.5 4.5h5L18 7" stroke={color} strokeWidth="2" />
				</svg>
			);
		case "cover":
			return (
				<svg width="22" height="31" viewBox="0 0 22 31" fill="none" aria-hidden>
					<path
						d="M4 8c0-3.3 2.7-6 6-6h2c3.3 0 6 2.7 6 6v15c0 3.3-2.7 6-6 6h-2c-3.3 0-6-2.7-6-6V8Z"
						fill={color}
					/>
					<path d="M4 14h14" stroke="#fff" strokeWidth="2" />
				</svg>
			);
		case "community":
			// 별(스타버스트) 안에 S가 들어간 커뮤니티 아이콘
			return (
				<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
					<path
						d="M14 1 16.3 8.46 23.19 4.81 19.54 11.7 27 14 19.54 16.3 23.19 23.19 16.3 19.54 14 27 11.7 19.54 4.81 23.19 8.46 16.3 1 14 8.46 11.7 4.81 4.81 11.7 8.46 14 1Z"
						fill={color}
					/>
					<text
						x="14"
						y="14.5"
						textAnchor="middle"
						dominantBaseline="central"
						fill="#fff"
						fontSize="10"
						fontWeight="900">
						S
					</text>
				</svg>
			);
		case "search":
			return (
				<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
					<circle cx="12.5" cy="12.5" r="7.5" stroke={color} strokeWidth="2.2" />
					<path
						d="m18.5 18.5 5.5 5.5"
						stroke={color}
						strokeWidth="2.2"
						strokeLinecap="round"
					/>
				</svg>
			);
		case "dm":
			return (
				<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
					<path
						d="M24.5 3.5 12.25 15.75M24.5 3.5 16.3 24.5l-4.05-8.75L3.5 11.7l21-8.2Z"
						stroke={color}
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			);
		case "artist":
			// 잉크펜(만년필 펜촉) — 타투이스트 모아보기
			return (
				<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
					<g transform="rotate(-45 14 14)">
						<path
							d="M14 3.5c3 3 4.6 6 4.6 9.3 0 4-2.4 7.6-4.6 10.4-2.2-2.8-4.6-6.4-4.6-10.4 0-3.3 1.6-6.3 4.6-9.3Z"
							stroke={color}
							strokeWidth="2"
							strokeLinejoin="round"
						/>
						<circle cx="14" cy="13.5" r="1.6" fill={color} />
						<path
							d="M14 15.1v6.4"
							stroke={color}
							strokeWidth="1.6"
							strokeLinecap="round"
						/>
					</g>
				</svg>
			);
		default:
			return null;
	}
}

export default function SideNav() {
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [communityHovered, setCommunityHovered] = useState(false);
	const { pathname } = useLocation();
	// 안읽은 메시지가 있는 채팅방 수 (읽으면 실시간으로 줄어듦)
	const readRoomIds = useDmStore((s) => s.readRoomIds);
	const unreadDmCount = MOCK_DM_ROOMS.filter(
		(room) => room.unreadCount > 0 && !readRoomIds.includes(room.id),
	).length;

	// 커뮤니티 관련 페이지에서는 하위 아이콘을 항상 펼쳐둔다
	const onCommunityPage = COMMUNITY_ITEMS.some((item) =>
		item.exact
			? pathname === item.to
			: pathname === item.to || pathname.startsWith(`${item.to}/`),
	);
	const communityExpanded = communityHovered || onCommunityPage;

	const renderItem = (item: NavItem, small = false) => {
		const isActive = item.exact
			? pathname === item.to
			: pathname === item.to || pathname.startsWith(`${item.to}/`);
		const showLabel = hoveredId === item.id;
		// 전체 아이콘은 살짝 작게, 커뮤니티는 살짝 크게, 펼쳐지는 하위 아이콘은 더 작게
		const boxSize = small ? "size-[42px]" : "size-[51px]";
		const iconScale =
			item.id === "community"
				? "scale-[1.05]"
				: item.id === "artist"
					? "scale-[0.88]"
					: small
						? "scale-[0.7]"
						: "scale-[0.85]";
		// 커뮤니티 그룹이 접혀 있을 때는 안읽은 DM 수를 커뮤니티 아이콘에 표시
		const badgeCount =
			unreadDmCount > 0 &&
			(item.id === "dm" || (item.id === "community" && !communityExpanded))
				? unreadDmCount
				: 0;

		return (
			<div
				key={item.id}
				className="relative"
				onMouseEnter={() => setHoveredId(item.id)}
				onMouseLeave={() => setHoveredId(null)}>
				<Link
					to={item.to}
					aria-label={item.label}
					aria-current={isActive ? "page" : undefined}
					className={`relative flex ${boxSize} items-center justify-center rounded-[10px] bg-white transition ${
						showLabel || isActive
							? "shadow-[0_0_15px_rgba(255,0,4,0.12),4px_8px_30px_rgba(0,0,0,0.15)]"
							: ""
					}`}>
					<span className={`flex items-center justify-center ${iconScale}`}>
						<NavIcon type={item.icon} active={showLabel || isActive} />
					</span>
					{badgeCount > 0 && (
						<span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-white">
							{badgeCount}
						</span>
					)}
				</Link>

				{showLabel && (
					<div className="pointer-events-none absolute left-[calc(100%+16px)] top-1/2 z-50 -translate-y-1/2">
						<div className="relative filter drop-shadow-[0_0_20px_rgba(0,0,0,0.15)]">
							<span
								aria-hidden
								className="absolute top-1/2 left-0 h-0 w-0 -translate-x-[10px] -translate-y-1/2 border-y-[10px] border-r-[12px] border-y-transparent border-r-white"
							/>
							<div className="flex h-[52px] min-w-[160px] items-center justify-center rounded-[50px] bg-white px-7">
								<span className="whitespace-nowrap text-[20px] font-bold leading-6 text-black">
									{item.label}
								</span>
							</div>
						</div>
					</div>
				)}
			</div>
		);
	};

	const [communityItem, ...communitySubItems] = COMMUNITY_ITEMS;

	return (
		<aside className="fixed bottom-0 left-0 top-[60px] z-40 flex w-20 flex-col items-center gap-3 bg-white pt-6">
			{MAIN_ITEMS.map((item) => renderItem(item))}

			{/* 커버업 타투와 커뮤니티 사이 구분선 */}
			<div aria-hidden className="h-px w-9 bg-gray-200" />

			<div
				className="flex flex-col items-center gap-2"
				onMouseEnter={() => setCommunityHovered(true)}
				onMouseLeave={() => setCommunityHovered(false)}>
				{renderItem(communityItem)}
				{communityExpanded && communitySubItems.map((item) => renderItem(item, true))}
			</div>
		</aside>
	);
}
