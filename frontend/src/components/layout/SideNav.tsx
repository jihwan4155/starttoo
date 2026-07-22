import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

type NavItem = {
	id: string;
	label: string;
	to: string;
	icon: "ai" | "sim" | "cover" | "community";
};

const NAV_ITEMS: NavItem[] = [
	{ id: "ai", label: "AI 도안 생성", to: "/ai", icon: "ai" },
	{ id: "sim", label: "타투 시뮬레이션", to: "/simulations", icon: "sim" },
	{ id: "cover", label: "커버업 타투", to: "/coverups", icon: "cover" },
	{ id: "community", label: "커뮤니티", to: "/posts", icon: "community" },
];

function NavIcon({ type, active }: { type: NavItem["icon"]; active: boolean }) {
	const color = active ? "#FF0004" : "#1A1A1A";

	switch (type) {
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
						d="M5 7.5A3.5 3.5 0 0 1 8.5 4h11A3.5 3.5 0 0 1 23 7.5v8A3.5 3.5 0 0 1 19.5 19H13l-5 4.5V19H8.5A3.5 3.5 0 0 1 5 15.5v-8Z"
						stroke={color}
						strokeWidth="2"
						strokeLinejoin="round"
					/>
				</svg>
			);
		default:
			return null;
	}
}

export default function SideNav() {
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const { pathname } = useLocation();

	return (
		<aside className="fixed bottom-0 left-0 top-[60px] z-40 flex w-20 flex-col items-center gap-6 bg-white pt-8">
			{NAV_ITEMS.map((item) => {
				const isActive =
					pathname === item.to || pathname.startsWith(`${item.to}/`);
				const showLabel = hoveredId === item.id;

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
							className={`flex size-[51px] items-center justify-center rounded-[10px] bg-white transition ${
								showLabel || isActive
									? "shadow-[0_0_15px_rgba(255,0,4,0.12),4px_8px_30px_rgba(0,0,0,0.15)]"
									: ""
							}`}>
							<NavIcon type={item.icon} active={showLabel || isActive} />
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
			})}
		</aside>
	);
}
