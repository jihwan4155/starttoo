import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/images/logo.png";
import topnavGrain from "../../assets/images/topnav-grain.png";
import ArtistSearchBar from "../artist/ArtistSearchBar";
import CommunitySearchBar from "../community/CommunitySearchBar";
import useUserStore from "../../store/useUserStore";
import useDmStore from "../../store/useDmStore";
import useNotificationStore from "../../store/useNotificationStore";

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

function NotificationBell() {
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const wrapRef = useRef<HTMLDivElement>(null);
	const notifications = useNotificationStore((s) => s.notifications);
	const markAllRead = useNotificationStore((s) => s.markAllRead);
	const openRoom = useDmStore((s) => s.openRoom);
	const unreadCount = notifications.filter((n) => !n.read).length;

	// 바깥 클릭 / ESC 시 닫기
	useEffect(() => {
		if (!open) return undefined;
		const onDown = (e: MouseEvent) => {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const handleClickNotification = (roomId: number) => {
		openRoom(roomId); // 방 열기 + 읽음 처리 + 관련 알림 읽음
		setOpen(false);
		navigate("/dm");
	};

	return (
		<div ref={wrapRef} className="relative">
			<button
				type="button"
				aria-label="알림"
				onClick={() => setOpen((v) => !v)}
				className="relative flex size-6 items-center justify-center">
				<BellIcon />
				{unreadCount > 0 && (
					<span className="absolute -right-1.5 -top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold leading-none text-white">
						{unreadCount}
					</span>
				)}
			</button>

			{open && (
				<div className="absolute right-0 top-[calc(100%+14px)] z-50 w-[320px] overflow-hidden rounded-[14px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
					<div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
						<span className="text-[14px] font-bold text-black">알림</span>
						{unreadCount > 0 && (
							<button
								type="button"
								onClick={markAllRead}
								className="text-[11px] font-light text-black/45 transition hover:text-black">
								모두 읽음
							</button>
						)}
					</div>
					<ul className="max-h-[380px] overflow-y-auto">
						{notifications.length === 0 ? (
							<li className="px-4 py-8 text-center text-[13px] font-light text-black/40">
								새로운 알림이 없어요.
							</li>
						) : (
							notifications.map((n) => (
								<li key={n.id}>
									<button
										type="button"
										onClick={() => handleClickNotification(n.roomId)}
										className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-black/[0.03] ${
											n.read ? "" : "bg-brand/[0.06]"
										}`}>
										<span className="mt-0.5 size-9 shrink-0 rounded-full bg-[#D9D9D9]" />
										<span className="min-w-0 flex-1">
											<span className="flex items-center gap-1.5">
												<span className="truncate text-[13px] font-semibold text-black">
													{n.title}
												</span>
												<span className="shrink-0 text-[10px] font-light text-black/35">
													{n.time}
												</span>
												{!n.read && (
													<span className="ml-auto size-[7px] shrink-0 rounded-full bg-brand" />
												)}
											</span>
											<span className="mt-0.5 block truncate text-[12px] font-light text-black/55">
												메시지: {n.body}
											</span>
										</span>
									</button>
								</li>
							))
						)}
					</ul>
				</div>
			)}
		</div>
	);
}

export default function TopNav() {
	const { pathname } = useLocation();
	// 피드 검색·타투이스트 페이지에서만 상단 검색 바 노출
	const showSearch = pathname.startsWith("/posts/search");
	const showArtistSearch = pathname.startsWith("/artists");
	const avatarUrl = useUserStore((s) => s.avatarUrl);

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

				{(showSearch || showArtistSearch) && (
					<div className="flex flex-1 justify-center px-8">
						{showSearch ? <CommunitySearchBar /> : <ArtistSearchBar />}
					</div>
				)}

				<div className="flex items-center gap-5">
					<NotificationBell />
					<button
						type="button"
						aria-label="설정"
						className="flex size-6 items-center justify-center">
						<SettingIcon />
					</button>
					<Link
						to="/mypage"
						aria-label="마이페이지"
						className="block size-9 shrink-0 overflow-hidden rounded-full bg-[#D9D9D9]">
						{avatarUrl && (
							<img src={avatarUrl} alt="" className="size-full object-cover" />
						)}
					</Link>
				</div>
			</div>
		</header>
	);
}
