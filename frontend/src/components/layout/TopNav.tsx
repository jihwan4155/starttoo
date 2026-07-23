import { Link, useLocation } from "react-router-dom";
import logo from "../../assets/images/logo.png";
import topnavGrain from "../../assets/images/topnav-grain.png";
import CommunitySearchBar from "../community/CommunitySearchBar";

function BellIcon() {
	return (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
			<path
				d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z"
				fill="#1A1A1A"
			/>
		</svg>
	);
}

function SettingIcon() {
	return (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
			<path
				d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z"
				stroke="#1A1A1A"
				strokeWidth="1.8"
			/>
			<path
				d="M19.4 13a7.9 7.9 0 0 0 .05-2l2.05-1.6-2-3.46-2.45.95a7.9 7.9 0 0 0-1.73-1L15 3h-6l-.32 2.89a7.9 7.9 0 0 0-1.73 1L4.5 5.94l-2 3.46L4.55 11a7.9 7.9 0 0 0 0 2l-2.05 1.6 2 3.46 2.45-.95a7.9 7.9 0 0 0 1.73 1L9 21h6l.32-2.89a7.9 7.9 0 0 0 1.73-1l2.45.95 2-3.46L19.4 13Z"
				stroke="#1A1A1A"
				strokeWidth="1.4"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export default function TopNav() {
	const { pathname } = useLocation();
	// 피드 검색 페이지에서만 상단 검색 바 노출
	const showSearch = pathname.startsWith("/posts/search");

	return (
		<header
			className="fixed inset-x-0 top-0 z-50 h-[60px]"
			style={{
				background: `url(${topnavGrain}) center / 100% 100% no-repeat, linear-gradient(90.22deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 80, 38, 0.7) 100.62%), #FFFFFF`,
			}}>
			<div className="relative z-10 flex h-full items-center justify-between pl-[12px] pr-7">
				{/* 검색 드롭다운이 잘리지 않도록 header 대신 로고에서만 클리핑 */}
				<Link
					to="/"
					className="flex h-[60px] items-center overflow-hidden"
					aria-label="starttoo 홈">
					<img
						src={logo}
						alt="starttoo"
						className="h-[66px] w-[122px] object-contain object-left"
					/>
				</Link>

				{showSearch && (
					<div className="flex flex-1 justify-center px-8">
						<CommunitySearchBar />
					</div>
				)}

				<div className="flex items-center gap-5">
					<button
						type="button"
						aria-label="알림"
						className="flex size-6 items-center justify-center">
						<BellIcon />
					</button>
					<button
						type="button"
						aria-label="설정"
						className="flex size-6 items-center justify-center">
						<SettingIcon />
					</button>
					<button
						type="button"
						aria-label="프로필"
						className="size-9 rounded-full bg-[#D9D9D9]"
					/>
				</div>
			</div>
		</header>
	);
}
