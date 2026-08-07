import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import useNavRefresh from "../../hooks/useNavRefresh";
import useUnreadCounts from "../../hooks/queries/useUnreadCounts";

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

const COMMUNITY_ITEMS: NavItem[] = [
	{
		id: "community",
		label: "커뮤니티",
		to: "/posts",
		icon: "community",
		exact: true,
	},
	{ id: "search", label: "피드", to: "/posts/search", icon: "search" },
	{ id: "dm", label: "메시지", to: "/dm", icon: "dm" },
	{ id: "artist", label: "타투이스트", to: "/artists", icon: "artist" },
];

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 244;
/** 아이콘을 접힌 너비(64) 기준으로 가운데 두기 위한 좌측 패딩 — 펼쳐도 아이콘 위치 고정 */
const ICON_INSET = 18;
const EXPAND_DELAY_MS = 100;
const COLLAPSE_DELAY_MS = 180;

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
	const [expanded, setExpanded] = useState(false);
	const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const { pathname } = useLocation();
	const navRefresh = useNavRefresh();
	const { data: unreadCounts } = useUnreadCounts();
	const unreadDmCount = unreadCounts?.byType.NEW_DM ?? 0;

	const clearTimers = () => {
		if (expandTimerRef.current) {
			clearTimeout(expandTimerRef.current);
			expandTimerRef.current = null;
		}
		if (collapseTimerRef.current) {
			clearTimeout(collapseTimerRef.current);
			collapseTimerRef.current = null;
		}
	};

	useEffect(() => () => clearTimers(), []);

	const handleMouseEnter = () => {
		if (collapseTimerRef.current) {
			clearTimeout(collapseTimerRef.current);
			collapseTimerRef.current = null;
		}
		if (expanded) return;
		expandTimerRef.current = setTimeout(() => {
			expandTimerRef.current = null;
			setExpanded(true);
		}, EXPAND_DELAY_MS);
	};

	const handleMouseLeave = () => {
		if (expandTimerRef.current) {
			clearTimeout(expandTimerRef.current);
			expandTimerRef.current = null;
		}
		collapseTimerRef.current = setTimeout(() => {
			collapseTimerRef.current = null;
			setExpanded(false);
		}, COLLAPSE_DELAY_MS);
	};

	const renderItem = (item: NavItem) => {
		const isActive = item.exact
			? pathname === item.to
			: pathname === item.to || pathname.startsWith(`${item.to}/`);
		const iconScale =
			item.id === "community"
				? "scale-[1.05]"
				: item.id === "artist"
					? "scale-[1.08]"
					: "scale-[0.85]";
		const badgeCount = item.id === "dm" && unreadDmCount > 0 ? unreadDmCount : 0;

		return (
			<Link
				key={item.id}
				to={item.to}
				aria-label={item.label}
				aria-current={isActive ? "page" : undefined}
				onClick={navRefresh(item.to)}
				style={{ paddingLeft: ICON_INSET }}
				className={`group relative flex h-12 w-full shrink-0 items-center rounded-[12px] pr-3 transition-colors hover:bg-black/[0.04] ${
					isActive ? "bg-black/[0.03]" : ""
				}`}>
				<span
					className={`relative flex size-7 shrink-0 items-center justify-center ${iconScale}`}>
					<NavIcon type={item.icon} active={isActive} />
					{badgeCount > 0 && (
						<span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-white">
							{badgeCount > 99 ? "99+" : badgeCount}
						</span>
					)}
				</span>
				<span
					aria-hidden={!expanded}
					className={`ml-4 shrink-0 whitespace-nowrap text-[15px] leading-5 text-black pointer-events-none ${
						isActive ? "font-bold" : "font-semibold"
					} ${
						expanded
							? "opacity-100 transition-opacity duration-150 delay-100"
							: "opacity-0 transition-opacity duration-75 delay-0"
					}`}>
					{item.label}
				</span>
			</Link>
		);
	};

	return (
		<aside
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			style={{ width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
			className={`fixed bottom-0 left-0 top-[52px] z-40 hidden flex-col overflow-hidden border-r bg-white pt-4 transition-[width,box-shadow,border-color] duration-300 ease-out lg:flex ${
				expanded
					? "border-black/10 shadow-[8px_0_24px_rgba(0,0,0,0.06)]"
					: "border-transparent"
			}`}>
			<nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden pb-6">
				{MAIN_ITEMS.map((item) => renderItem(item))}

				<div
					aria-hidden
					className="my-2 h-px shrink-0 bg-gray-200 transition-[width] duration-300 ease-out"
					style={{
						marginLeft: ICON_INSET,
						width: expanded ? EXPANDED_WIDTH - ICON_INSET * 2 : 36,
					}}
				/>

				{COMMUNITY_ITEMS.map((item) => renderItem(item))}
			</nav>
		</aside>
	);
}
