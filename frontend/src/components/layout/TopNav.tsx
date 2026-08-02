import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/images/logo.png";
import topnavGrain from "../../assets/images/topnav-grain.png";
import ArtistSearchBar from "../artist/ArtistSearchBar";
import CommunitySearchBar from "../community/CommunitySearchBar";
import NotificationListItem from "../notifications/NotificationListItem";
import SystemNotificationModal from "../notifications/SystemNotificationModal";
import useNotificationPreview from "../../hooks/queries/useNotificationPreview";
import useUnreadCounts from "../../hooks/queries/useUnreadCounts";
import {
	useMarkAllNotificationsRead,
} from "../../hooks/mutations/useMarkNotificationsRead";
import useNotificationAction from "../../hooks/useNotificationAction";
import useUserStore from "../../store/useUserStore";
import useAuthStore from "../../store/useAuthStore";
import useNotificationStore from "../../store/useNotificationStore";
import useDmStore from "../../store/useDmStore";
import type { NotificationItem } from "../../types/notification";
import { resolveAvatar } from "../../utils/profile";

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
	const [systemModalItem, setSystemModalItem] =
		useState<NotificationItem | null>(null);
	const wrapRef = useRef<HTMLDivElement>(null);
	const accessToken = useAuthStore((s) => s.accessToken);
	const notifications = useNotificationStore((s) => s.notifications);
	const markAllReadMock = useNotificationStore((s) => s.markAllRead);
	const openRoom = useDmStore((s) => s.openRoom);

	const { data: preview, isLoading, error } = useNotificationPreview();
	// 목록 응답에는 총 미확인 수가 없어 뱃지 숫자는 별도 엔드포인트에서 받는다.
	const { data: unreadCounts } = useUnreadCounts();
	const { mutate: markAllRead } = useMarkAllNotificationsRead();
	const handleServerNotification = useNotificationAction({
		onSystemOpen: (item) => setSystemModalItem(item),
	});

	const serverEnabled = Boolean(accessToken);
	const serverItems = preview?.items ?? [];
	const serverUnreadCount = unreadCounts?.total ?? 0;
	const mockUnread = notifications.filter((n) => !n.read).length;
	const unreadCount = serverEnabled ? serverUnreadCount : mockUnread;

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

	const handleClickMockNotification = useCallback(
		(roomId: number) => {
			openRoom(roomId);
			setOpen(false);
			navigate("/dm");
		},
		[navigate, openRoom],
	);

	const handleClickServerNotification = useCallback(
		async (item: NotificationItem) => {
			setOpen(false);
			await handleServerNotification(item);
		},
		[handleServerNotification],
	);

	const handleMarkAll = () => {
		if (serverEnabled) markAllRead({ items: serverItems });
		else markAllReadMock();
	};

	return (
		<div ref={wrapRef} className="relative">
			<SystemNotificationModal
				item={systemModalItem}
				isOpen={systemModalItem != null}
				onClose={() => setSystemModalItem(null)}
			/>
			<button
				type="button"
				aria-label="알림"
				onClick={() => setOpen((v) => !v)}
				className="relative flex size-6 items-center justify-center">
				<BellIcon />
				{unreadCount > 0 && (
					<span className="absolute -right-1.5 -top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold leading-none text-white">
						{unreadCount > 99 ? "99+" : unreadCount}
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
								onClick={handleMarkAll}
								className="text-[11px] font-light text-black/45 transition hover:text-black">
								모두 읽음
							</button>
						)}
					</div>

					<ul className="max-h-[380px] overflow-y-auto">
						{serverEnabled ? (
							serverItems.length === 0 ? (
								<li className="px-4 py-8 text-center text-[13px] font-light text-black/40">
									{isLoading
										? "불러오는 중…"
										: (error?.message ?? "새로운 알림이 없어요.")}
								</li>
							) : (
								serverItems.map((item) => (
									<NotificationListItem
										key={item.notificationSeq}
										item={item}
										compact
										onClick={(target) =>
											void handleClickServerNotification(target)
										}
									/>
								))
							)
						) : notifications.length === 0 ? (
							<li className="px-4 py-8 text-center text-[13px] font-light text-black/40">
								새로운 알림이 없어요.
							</li>
						) : (
							notifications.map((n) => (
								<li key={n.id}>
									<button
										type="button"
										onClick={() => handleClickMockNotification(n.roomId)}
										className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-black/[0.03] ${
											n.read ? "" : "bg-brand/[0.06]"
										}`}>
										<img
											src={resolveAvatar(undefined, n.title)}
											alt=""
											className="mt-0.5 size-9 shrink-0 rounded-full bg-[#D9D9D9] object-cover"
										/>
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

					{serverEnabled && (
						<div className="border-t border-black/10 px-4 py-3 text-center">
							<Link
								to="/notifications"
								onClick={() => setOpen(false)}
								className="text-[13px] font-semibold text-brand transition hover:underline">
								알림 전체 보기
							</Link>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/** 설정(톱니) 버튼 — 누르면 로그아웃 등 메뉴가 토글로 열린다 */
function SettingMenu() {
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const wrapRef = useRef<HTMLDivElement>(null);
	const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken));
	const logout = useAuthStore((s) => s.logout);

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

	const handleLogout = async () => {
		setOpen(false);
		await logout();
		// 로그인 필요 페이지에 있었다면 가드가 /login으로 보내므로 홈으로 명시 이동
		navigate("/", { replace: true });
	};

	return (
		<div ref={wrapRef} className="relative">
			<button
				type="button"
				aria-label="설정"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className="flex size-6 items-center justify-center">
				<SettingIcon />
			</button>

			{open && (
				<div className="absolute right-0 top-[calc(100%+14px)] z-50 w-[160px] overflow-hidden rounded-[14px] bg-white py-1 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
					{isLoggedIn ? (
						<button
							type="button"
							onClick={() => void handleLogout()}
							className="block w-full px-4 py-2.5 text-left text-[13px] font-semibold text-black transition hover:bg-black/[0.04]">
							로그아웃
						</button>
					) : (
						<Link
							to="/login"
							onClick={() => setOpen(false)}
							className="block w-full px-4 py-2.5 text-left text-[13px] font-semibold text-black transition hover:bg-black/[0.04]">
							로그인
						</Link>
					)}
				</div>
			)}
		</div>
	);
}

export default function TopNav() {
	const { pathname } = useLocation();
	const showSearch = pathname.startsWith("/posts/search");
	const showArtistSearch = pathname.startsWith("/artists");
	const avatarUrl = useUserStore((s) => s.avatarUrl);
	const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken));

	return (
		<header
			className="fixed inset-x-0 top-0 z-50 h-[60px]"
			style={{
				background: `url(${topnavGrain}) center / 100% 100% no-repeat, linear-gradient(90.22deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 80, 38, 0.7) 100.62%), #FFFFFF`,
			}}>
			<div className="relative z-10 flex h-full items-center justify-between pl-[12px] pr-7">
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
					<SettingMenu />
					{/* 미로그인 상태에서는 로그인 화면으로 안내한다 */}
					<Link
						to={isLoggedIn ? "/mypage" : "/login"}
						aria-label={isLoggedIn ? "마이페이지" : "로그인"}
						className="block size-9 shrink-0 overflow-hidden rounded-full bg-[#D9D9D9]">
						<img
							src={resolveAvatar(avatarUrl)}
							alt=""
							className="size-full object-cover"
						/>
					</Link>
				</div>
			</div>
		</header>
	);
}
