import { createPortal } from "react-dom";

type ConfirmModalProps = {
	title: string;
	isOpen: boolean;
	onClose: () => void;
	/** 왼쪽(보조) 버튼 텍스트. 예: "보관함 가기" */
	cancelText: string;
	/** 오른쪽(주요) 버튼 텍스트. 예: "시뮬레이션 보기" */
	confirmText: string;
	onCancel?: () => void;
	onConfirm?: () => void;
};

export default function ConfirmModal({
	title,
	isOpen,
	onClose,
	cancelText,
	confirmText,
	onCancel,
	onConfirm,
}: ConfirmModalProps) {
	if (!isOpen) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
			onClick={onClose}
			role="presentation">
			<div
				className="relative w-full max-w-[560px] rounded-2xl bg-white px-4 pb-5 pt-12 shadow-xl sm:px-8 sm:pb-8 sm:pt-14"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label={title}>
				<button
					type="button"
					aria-label="닫기"
					onClick={onClose}
					className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-black transition hover:bg-black/5 sm:right-5 sm:top-5">
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round">
						<path d="M5 5l14 14M19 5L5 19" />
					</svg>
				</button>

				<p className="text-center text-[20px] font-semibold text-black sm:text-[26px]">
					{title}
				</p>

				<div className="mt-7 grid grid-cols-2 gap-2 sm:mt-10 sm:gap-4">
					<button
						type="button"
						onClick={onCancel ?? onClose}
						className="h-12 min-w-0 rounded-full border border-black/20 bg-white px-2 text-[14px] font-semibold text-black transition hover:bg-black/5 active:scale-[0.99] sm:h-[56px] sm:text-[18px]">
						{cancelText}
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="h-12 min-w-0 rounded-full bg-brand px-2 text-[14px] font-semibold text-white transition hover:brightness-95 active:scale-[0.99] sm:h-[56px] sm:text-[18px]">
						{confirmText}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
