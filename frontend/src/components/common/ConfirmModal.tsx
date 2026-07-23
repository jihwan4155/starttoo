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
			className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-6 sm:items-center"
			onClick={onClose}
			role="presentation">
			<div
				className="relative w-full max-w-[560px] rounded-2xl bg-white px-8 pb-8 pt-14 shadow-xl"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label={title}>
				<button
					type="button"
					aria-label="닫기"
					onClick={onClose}
					className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-black transition hover:bg-black/5">
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

				<p className="text-center text-[26px] font-semibold text-black">
					{title}
				</p>

				<div className="mt-10 flex gap-4">
					<button
						type="button"
						onClick={onCancel ?? onClose}
						className="h-[56px] flex-1 rounded-full border border-black/20 bg-white text-[18px] font-semibold text-black transition hover:bg-black/5 active:scale-[0.99]">
						{cancelText}
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="h-[56px] flex-1 rounded-full bg-brand text-[18px] font-semibold text-white transition hover:brightness-95 active:scale-[0.99]">
						{confirmText}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
