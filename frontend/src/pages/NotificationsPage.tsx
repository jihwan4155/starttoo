import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import StarttooLoader from "../components/loader/StarttooLoader";
import NotificationListItem from "../components/notifications/NotificationListItem";
import SystemNotificationModal from "../components/notifications/SystemNotificationModal";
import { useMarkAllNotificationsRead } from "../hooks/mutations/useMarkNotificationsRead";
import useUnreadNotifications from "../hooks/queries/useUnreadNotifications";
import useNotificationAction from "../hooks/useNotificationAction";
import useAuthStore from "../store/useAuthStore";
import { ApiError } from "../services/api";
import type { NotificationItem } from "../types/notification";

/** GET /notifications — 미확인 알림만 표시 */
export default function NotificationsPage() {
	const accessToken = useAuthStore((s) => s.accessToken);
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const [systemModalItem, setSystemModalItem] =
		useState<NotificationItem | null>(null);

	const handleNotification = useNotificationAction({
		onSystemOpen: (item) => setSystemModalItem(item),
	});

	const { mutate: markAllRead, isPending: isMarkAllPending } =
		useMarkAllNotificationsRead();

	const {
		data,
		isPending,
		isError,
		error,
		refetch,
		isFetching,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useUnreadNotifications(20);

	const items = useMemo(
		() => data?.pages.flatMap((page) => page.items) ?? [],
		[data?.pages],
	);

	useEffect(() => {
		const node = loadMoreRef.current;
		if (!node) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				if (
					entry?.isIntersecting &&
					hasNextPage &&
					!isFetchingNextPage &&
					!isError
				) {
					void fetchNextPage();
				}
			},
			{ root: null, rootMargin: "240px", threshold: 0 },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage, isError]);

	const errorMessage =
		error instanceof ApiError
			? error.message
			: "알림을 불러오지 못했습니다.";

	if (!accessToken) {
		return (
			<div className="min-h-[calc(100vh-60px)] bg-surface pb-16 pt-8">
				<div className="mx-auto w-full max-w-[440px] px-4 py-20 text-center">
					<p className="text-[15px] font-semibold text-black/80">
						로그인이 필요합니다
					</p>
					<p className="mt-2 text-[13px] font-light text-black/45">
						알림을 확인하려면 로그인해 주세요.
					</p>
					<Link
						to="/"
						className="mt-6 inline-block text-[13px] font-semibold text-brand hover:underline">
						홈으로 돌아가기
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface pb-16 pt-8">
			<SystemNotificationModal
				item={systemModalItem}
				isOpen={systemModalItem != null}
				onClose={() => setSystemModalItem(null)}
			/>

			<div className="mx-auto w-full max-w-[440px] -translate-x-10 px-4">
				<div className="flex items-center justify-between">
					<h1 className="text-[22px] font-bold text-black">알림</h1>
					{items.length > 0 && (
						<button
							type="button"
							onClick={() => markAllRead({ items })}
							disabled={isMarkAllPending}
							className="text-[13px] font-light text-black/45 transition hover:text-black disabled:opacity-50">
							모두 읽음
						</button>
					)}
				</div>

				<p className="mt-1 text-[13px] font-light text-black/45">
					메시지·시스템 알림만 표시됩니다.
				</p>

				<div className="mt-6 overflow-hidden rounded-[14px] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
					{isPending && (
						<StarttooLoader variant="block" label="알림을 불러오는 중…" />
					)}

					{isError && items.length === 0 && (
						<div className="flex flex-col items-center gap-4 px-5 py-16">
							<p className="text-center text-[14px] text-black/60">
								{errorMessage}
							</p>
							<button
								type="button"
								onClick={() => void refetch()}
								disabled={isFetching}
								className="rounded-full border border-black/20 px-5 py-2 text-[13px] font-semibold transition hover:bg-black/5 disabled:opacity-50">
								다시 시도
							</button>
						</div>
					)}

					{!isPending && !isError && items.length === 0 && (
						<p className="px-5 py-16 text-center text-[14px] font-light text-black/40">
							새로운 알림이 없어요.
						</p>
					)}

					{items.length > 0 && (
						<ul className="divide-y divide-black/[0.06]">
							{items.map((item) => (
								<NotificationListItem
									key={item.notificationSeq}
									item={item}
									onClick={(target) =>
										void handleNotification(target)
									}
								/>
							))}
						</ul>
					)}
				</div>

				{items.length > 0 && (
					<div ref={loadMoreRef} className="py-6 text-center">
						{isFetchingNextPage && (
							<div className="flex items-center justify-center gap-2 text-[13px] text-black/40">
								<StarttooLoader variant="mark" label={null} /> 더 불러오는 중…
							</div>
						)}
						{!hasNextPage && !isFetchingNextPage && (
							<p className="text-[13px] text-black/30">
								확인할 알림을 모두 불러왔습니다
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
