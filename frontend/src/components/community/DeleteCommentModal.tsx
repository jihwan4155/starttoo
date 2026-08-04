import { createPortal } from "react-dom";

type DeleteCommentModalProps = {
	isOpen: boolean;
	content: string;
	onClose: () => void;
	onConfirm: () => void;
	isPending?: boolean;
};

/** 댓글 삭제 확인 */
export default function DeleteCommentModal({
	isOpen,
	content,
	onClose,
	onConfirm,
	isPending = false,
}: DeleteCommentModalProps) {
	if (!isOpen) return null;

	const preview =
		content.length > 80 ? `${content.slice(0, 80)}…` : content;

	return createPortal(
		<div
			className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-6 backdrop-blur-[2px]"
			onClick={onClose}
			role="presentation">
			<div
				className="relative w-full max-w-[360px] overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="댓글 삭제 확인">
				<div className="h-14 bg-gradient-to-r from-brand/12 via-brand/5 to-transparent" />

				<div className="px-6 pb-6 pt-2">
					<div className="mx-auto -mt-8 flex size-14 items-center justify-center rounded-full border-4 border-white bg-brand/10 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
						<svg
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="#ff4646"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden>
							<path d="M4 7h16" />
							<path d="M10 11v6" />
							<path d="M14 11v6" />
							<path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
							<path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
						</svg>
					</div>

					<p className="mt-4 text-center text-[18px] font-bold text-black">
						댓글을 삭제할까요?
					</p>
					<p className="mt-2 text-center text-[13px] font-light leading-5 text-black/50">
						삭제한 댓글은 복구할 수 없습니다.
					</p>

					<div className="mt-4 rounded-[12px] border border-black/[0.06] bg-black/[0.02] px-4 py-3">
						<p className="line-clamp-3 text-[13px] font-light leading-5 text-black/70">
							{preview || "댓글 내용 없음"}
						</p>
					</div>

					<div className="mt-6 flex gap-3">
						<button
							type="button"
							onClick={onClose}
							disabled={isPending}
							className="h-11 flex-1 rounded-full border border-black/15 bg-white text-[14px] font-semibold text-black transition hover:bg-black/5 disabled:opacity-50">
							취소
						</button>
						<button
							type="button"
							onClick={onConfirm}
							disabled={isPending}
							className="h-11 flex-1 rounded-full bg-brand text-[14px] font-semibold text-white transition hover:brightness-95 disabled:opacity-50">
							{isPending ? "삭제 중…" : "삭제"}
						</button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}
