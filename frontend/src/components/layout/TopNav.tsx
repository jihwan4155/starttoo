import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/images/logo.png";
import mobileLogo from "../../assets/images/mobile-logo.png";
import ArtistSearchBar from "../artist/ArtistSearchBar";
import LoginModal from "../auth/LoginModal";
import WithdrawAccountModal from "../auth/WithdrawAccountModal";
import CommunitySearchBar from "../community/CommunitySearchBar";
import NotificationListItem from "../notifications/NotificationListItem";
import SystemNotificationModal from "../notifications/SystemNotificationModal";
import useNotificationPreview from "../../hooks/queries/useNotificationPreview";
import useUnreadCounts from "../../hooks/queries/useUnreadCounts";
import {
	useMarkAllNotificationsRead,
} from "../../hooks/mutations/useMarkNotificationsRead";
import useBackClose from "../../hooks/useBackClose";
import useNavRefresh from "../../hooks/useNavRefresh";
import useNotificationAction from "../../hooks/useNotificationAction";
import useUserStore from "../../store/useUserStore";
import useAuthStore from "../../store/useAuthStore";
import useNotificationStore from "../../store/useNotificationStore";
import useDmStore from "../../store/useDmStore";
import useToastStore from "../../store/useToastStore";
import type { NotificationItem } from "../../types/notification";
import { DEFAULT_PROFILE_IMAGE, resolveAvatar } from "../../utils/profile";

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

/** 설정(톱니) 버튼 — 누르면 로그인·로그아웃·회원탈퇴 메뉴가 토글로 열린다 */
function SettingMenu({ onRequestLogin }: { onRequestLogin: () => void }) {
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [withdrawOpen, setWithdrawOpen] = useState(false);
	const wrapRef = useRef<HTMLDivElement>(null);
	const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken));
	const logout = useAuthStore((s) => s.logout);
	const showToast = useToastStore((s) => s.showToast);

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
		showToast("로그아웃되었습니다.");
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
						<>
							<button
								type="button"
								onClick={() => void handleLogout()}
								className="block w-full px-4 py-2.5 text-left text-[13px] font-semibold text-black transition hover:bg-black/[0.04]">
								로그아웃
							</button>
							{/* 되돌릴 수 없는 동작이라 색으로 구분하고, 실제 실행은 확인 모달에서 받는다 */}
							<button
								type="button"
								onClick={() => {
									setOpen(false);
									setWithdrawOpen(true);
								}}
								className="block w-full px-4 py-2.5 text-left text-[13px] font-semibold text-brand transition hover:bg-black/[0.04]">
								회원탈퇴
							</button>
						</>
					) : (
						<button
							type="button"
							onClick={() => {
								setOpen(false);
								onRequestLogin();
							}}
							className="block w-full px-4 py-2.5 text-left text-[13px] font-semibold text-black transition hover:bg-black/[0.04]">
							로그인
						</button>
					)}
				</div>
			)}

			<WithdrawAccountModal
				isOpen={withdrawOpen}
				onClose={() => setWithdrawOpen(false)}
				onWithdrawn={() => {
					setWithdrawOpen(false);
					// 로그인 필요 페이지에 있었다면 가드가 /login으로 보내므로 홈으로 명시 이동
					navigate("/", { replace: true });
					// 탈퇴도 세션이 끊기는 동작이라 로그아웃과 같은 방식으로 알린다.
					showToast("회원탈퇴가 완료되었습니다.");
				}}
			/>
		</div>
	);
}

function MenuIcon() {
	return (
		<span className="relative block h-[18px] w-[21px]" aria-hidden>
			<span className="absolute left-0 top-0.5 h-0.5 w-[21px] rounded-full bg-black" />
			<span className="absolute left-0 top-2 h-0.5 w-[21px] rounded-full bg-black" />
			<span className="absolute left-0 top-[14px] h-0.5 w-[21px] rounded-full bg-black" />
		</span>
	);
}

const MOBILE_MENU_ITEMS = [
	{ label: "홈", to: "/" },
	{ label: "AI 도안 생성", to: "/ai" },
	{ label: "타투 시뮬레이션", to: "/simulations" },
	{ label: "커버업 타투", to: "/coverups" },
	{ label: "커뮤니티", to: "/posts", dividerBefore: true, exact: true },
	{ label: "피드", to: "/posts/search" },
	{ label: "메시지", to: "/dm" },
	{ label: "타투이스트", to: "/artists" },
	{ label: "마이페이지", to: "/mypage" },
] as const;

function isMobileMenuItemActive(
	item: (typeof MOBILE_MENU_ITEMS)[number],
	pathname: string,
) {
	if (item.to === "/") return pathname === "/";
	if ("exact" in item && item.exact) return pathname === item.to;
	return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function MobileTopNav() {
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [withdrawOpen, setWithdrawOpen] = useState(false);
	const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken));
	const logout = useAuthStore((s) => s.logout);
	const showToast = useToastStore((s) => s.showToast);
	// 보고 있는 화면의 메뉴를 다시 누르면 새로고침
	const navRefresh = useNavRefresh();

	useEffect(() => setOpen(false), [pathname]);

	// 뒤로가기는 앞 화면으로 나가는 대신 메뉴만 닫는다
	useBackClose(open, () => setOpen(false));

	useEffect(() => {
		if (!open) return undefined;
		const previousOverflow = document.body.style.overflow;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.body.style.overflow = "hidden";
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [open]);

	const handleLogout = async () => {
		setOpen(false);
		await logout();
		navigate("/", { replace: true });
		showToast("로그아웃되었습니다.");
	};

	return (
		<>
			<header className="fixed inset-x-0 top-0 z-[60] h-[44px] border-b border-black/10 bg-white lg:hidden">
				<div className="grid h-full grid-cols-[48px_1fr_48px] items-center px-4">
					<button
						type="button"
						aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
						aria-expanded={open}
						onClick={() => setOpen((value) => !value)}
						className="flex size-10 items-center justify-start outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
						<MenuIcon />
					</button>

					<Link
						to="/"
						aria-label="starttoo 홈"
						className="justify-self-center">
						<img
							src={mobileLogo}
							alt="starttoo"
							className="h-4 w-[96px] object-contain"
						/>
					</Link>

					<div className="flex size-10 items-center justify-end justify-self-end">
						<NotificationBell />
					</div>
				</div>
			</header>

			{open && (
				<div
					className="fixed inset-x-0 bottom-0 top-[44px] z-50 bg-black/45 lg:hidden"
					onClick={() => setOpen(false)}>
					<div
						role="dialog"
						aria-modal="true"
						aria-label="전체 메뉴"
						onClick={(event) => event.stopPropagation()}
						className="max-h-[calc(100dvh-44px)] overflow-y-auto rounded-b-[24px] bg-white pb-6 shadow-[0_20px_45px_rgba(0,0,0,0.12)]">
						<nav className="flex flex-col items-center gap-4 px-6 pb-4 pt-3">
							{MOBILE_MENU_ITEMS.map((item) => {
								const active = isMobileMenuItemActive(item, pathname);
								return (
									<div key={item.to} className={`flex w-full justify-center ${"dividerBefore" in item && item.dividerBefore ? "border-t border-black/15 pt-4" : ""}`}>
										<Link
											to={item.to}
											onClick={(event) => {
												// 같은 화면이면 주소가 그대로라 메뉴가 저절로 닫히지 않는다
												setOpen(false);
												navRefresh(item.to)(event);
											}}
											aria-current={active ? "page" : undefined}
											className={`text-[17px] leading-6 tracking-[-0.03em] transition ${active ? "font-semibold text-black" : "font-normal text-black/90"}`}>
											{item.label}
										</Link>
									</div>
								);
							})}
						</nav>

						<div className="mx-6 border-t border-black/15" />
						<div className="flex flex-col items-center gap-4 px-6 pt-4">
							<Link
								to="/notifications"
								className="text-[17px] font-normal leading-6 tracking-[-0.03em] text-black/90">
								알림
							</Link>
							{isLoggedIn ? (
								<>
									<button
										type="button"
										onClick={() => void handleLogout()}
										className="text-[17px] font-normal leading-6 tracking-[-0.03em] text-black/90">
										로그아웃
									</button>
									{/* 되돌릴 수 없는 동작이라 색으로 구분하고, 실제 실행은 확인 모달에서 받는다 */}
									<button
										type="button"
										onClick={() => {
											setOpen(false);
											setWithdrawOpen(true);
										}}
										className="text-[17px] font-normal leading-6 tracking-[-0.03em] text-brand">
										회원탈퇴
									</button>
								</>
							) : (
								<Link to="/login" className="text-[17px] font-normal leading-6 tracking-[-0.03em] text-black/90">
									로그인
								</Link>
							)}
						</div>
					</div>
				</div>
			)}

			<WithdrawAccountModal
				isOpen={withdrawOpen}
				onClose={() => setWithdrawOpen(false)}
				onWithdrawn={() => {
					setWithdrawOpen(false);
					// 로그인 필요 페이지에 있었다면 가드가 /login으로 보내므로 홈으로 명시 이동
					navigate("/", { replace: true });
					showToast("회원탈퇴가 완료되었습니다.");
				}}
			/>
		</>
	);
}

export default function TopNav() {
	const { pathname } = useLocation();
	const showSearch = pathname.startsWith("/posts/search");
	const showArtistSearch = pathname.startsWith("/artists");
	const avatarUrl = useUserStore((s) => s.avatarUrl);
	const headerAvatar = avatarUrl || DEFAULT_PROFILE_IMAGE;
	const usesDefaultHeaderAvatar = !avatarUrl;
	const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken));
	// 설정 메뉴와 아바타가 같은 모달을 열기 때문에 상태를 여기서 들고 있는다.
	const [loginOpen, setLoginOpen] = useState(false);

	return (
		<>
			<MobileTopNav />
		<header className="fixed inset-x-0 top-0 z-50 hidden h-[52px] bg-white lg:block">
			<div className="relative z-10 flex h-full items-center justify-between pl-[12px] pr-7">
				<Link
					to="/"
					className="flex h-[52px] items-center overflow-hidden"
					aria-label="starttoo 홈">
					<img
						src={logo}
						alt="starttoo"
						className="h-[48px] w-[100px] object-contain object-left"
					/>
				</Link>

				{(showSearch || showArtistSearch) && (
					<div className="flex flex-1 justify-center px-8">
						{showSearch ? <CommunitySearchBar /> : <ArtistSearchBar />}
					</div>
				)}

				<div className="flex items-center gap-5">
					<NotificationBell />
					<SettingMenu onRequestLogin={() => setLoginOpen(true)} />
					{/* 미로그인 상태에서는 화면을 떠나지 않고 로그인 모달을 띄운다 */}
					{isLoggedIn ? (
						<Link
							to="/mypage"
							aria-label="마이페이지"
							className="block size-7 shrink-0 overflow-hidden rounded-full bg-white">
							<img
								src={headerAvatar}
								alt=""
								className={`size-full ${usesDefaultHeaderAvatar ? "object-contain" : "object-cover"}`}
							/>
						</Link>
					) : (
						<button
							type="button"
							onClick={() => setLoginOpen(true)}
							aria-label="로그인"
						className="block size-7 shrink-0 overflow-hidden rounded-full bg-white">
						<img
							src={headerAvatar}
							alt=""
							className={`size-full ${usesDefaultHeaderAvatar ? "object-contain" : "object-cover"}`}
							/>
						</button>
					)}
				</div>
			</div>

			<LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
		</header>
		</>
	);
}
