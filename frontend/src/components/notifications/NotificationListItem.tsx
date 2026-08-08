import type { NotificationItem } from "../../types/notification";
import { avatarImageClassName, resolveAvatar } from "../../utils/profile";
import {
	formatNotifTime,
	getNotificationTypeLabel,
} from "../../utils/notification";
import { dmPreviewText } from "../../utils/sharePost";

type NotificationListItemProps = {
	item: NotificationItem;
	onClick: (item: NotificationItem) => void;
	compact?: boolean;
};

function SystemIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden
			className="text-black/55">
			<path
				d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z"
				fill="currentColor"
			/>
		</svg>
	);
}

/** DM·시스템 알림 공통 목록 행 */
export default function NotificationListItem({
	item,
	onClick,
	compact = false,
}: NotificationListItemProps) {
	const isDm = item.notificationType === "NEW_DM";
	const typeLabel = getNotificationTypeLabel(item.notificationType);
	const dmAvatar = resolveAvatar(undefined, item.title);

	return (
		<li>
			<button
				type="button"
				onClick={() => onClick(item)}
				className={`flex w-full items-start gap-3 bg-brand/[0.06] text-left transition hover:bg-black/[0.03] ${
					compact ? "px-4 py-3" : "px-5 py-4"
				}`}>
				{isDm ? (
					<img
						src={dmAvatar}
						alt=""
						className={`mt-0.5 size-10 shrink-0 rounded-full ${avatarImageClassName(dmAvatar)}`}
					/>
				) : (
					<span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-black/[0.06]">
						<SystemIcon />
					</span>
				)}

				<span className="min-w-0 flex-1">
					<span className="flex flex-wrap items-center gap-1.5">
						<span
							className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
								isDm
									? "bg-brand/10 text-brand"
									: "bg-black/[0.06] text-black/55"
							}`}>
							{typeLabel}
						</span>
						<span className="truncate text-[14px] font-semibold text-black">
							{item.title}
						</span>
						<span className="shrink-0 text-[11px] font-light text-black/35">
							{formatNotifTime(item.regDttm)}
						</span>
						<span className="ml-auto size-[7px] shrink-0 rounded-full bg-brand" />
					</span>
					<span
						className={`mt-1 block text-black/55 ${
							compact
								? "truncate text-[12px] font-light"
								: "text-[13px] font-light leading-5"
						}`}>
						{/* DM 알림 본문은 메시지 원문이라 공유 주소가 그대로 비친다 */}
						{isDm ? dmPreviewText(item.body) : item.body}
					</span>
				</span>
			</button>
		</li>
	);
}
