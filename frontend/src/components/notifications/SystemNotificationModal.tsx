import { createPortal } from "react-dom";
import type { NotificationItem } from "../../types/notification";
import { formatNotifTime, getNotificationTypeLabel } from "../../utils/notification";

type SystemNotificationModalProps = {
	item: NotificationItem | null;
	isOpen: boolean;
	onClose: () => void;
};

/** 시스템 알림 상세 — 읽음 처리 후 내용 확인 */
export default function SystemNotificationModal({
	item,
	isOpen,
	onClose,
}: SystemNotificationModalProps) {
	if (!isOpen || !item) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-6 backdrop-blur-[2px]"
			onClick={onClose}
			role="presentation">
			<div
				className="relative w-full max-w-[360px] overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="시스템 알림">
				<div className="h-14 bg-gradient-to-r from-black/[0.04] via-black/[0.02] to-transparent" />

				<div className="px-6 pb-6 pt-2">
					<div className="mx-auto -mt-8 flex size-14 items-center justify-center rounded-full border-4 border-white bg-black/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
						<svg
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							aria-hidden>
							<path
								d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z"
								fill="#1A1A1A"
							/>
						</svg>
					</div>

					<p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-wide text-black/40">
						{getNotificationTypeLabel(item.notificationType)}
					</p>
					<p className="mt-1 text-center text-[18px] font-bold text-black">
						{item.title}
					</p>
					<p className="mt-1 text-center text-[12px] font-light text-black/40">
						{formatNotifTime(item.createdAt)}
					</p>

					<div className="mt-4 rounded-[12px] border border-black/[0.06] bg-black/[0.02] px-4 py-3">
						<p className="whitespace-pre-wrap text-[13px] font-light leading-5 text-black/70">
							{item.body}
						</p>
					</div>

					<button
						type="button"
						onClick={onClose}
						className="mt-6 h-11 w-full rounded-full bg-brand text-[14px] font-semibold text-white transition hover:brightness-95">
						확인
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
