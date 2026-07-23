import { Link } from "react-router-dom";

type SaveConfirmModalProps = {
	onClose: () => void;
};

function CloseIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
			<path
				d="M5 5l10 10M15 5 5 15"
				stroke="#1A1A1A"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export default function SaveConfirmModal({ onClose }: SaveConfirmModalProps) {
	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-6"
			onClick={onClose}
			role="presentation">
			<div
				className="relative w-full max-w-[480px] rounded-[20px] bg-white px-10 py-12"
				onClick={(event) => event.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="저장 완료">
				<button
					type="button"
					onClick={onClose}
					aria-label="닫기"
					className="absolute right-5 top-5 flex size-8 items-center justify-center">
					<CloseIcon />
				</button>

				<p className="text-center text-[28px] font-bold leading-8 text-black">
					저장되었습니다
				</p>

				<div className="mt-10 flex items-center justify-center gap-4">
					<button
						type="button"
						className="inline-flex h-[52px] min-w-[140px] items-center justify-center rounded-[50px] border border-black bg-white px-6 text-[18px] font-semibold text-black transition hover:bg-gray-50">
						보관함 가기
					</button>
					<Link
						to="/simulations"
						onClick={onClose}
						className="inline-flex h-[52px] min-w-[140px] items-center justify-center rounded-[50px] bg-brand px-6 text-[18px] font-semibold text-white transition hover:brightness-95">
						시뮬레이션 보기
					</Link>
				</div>
			</div>
		</div>
	);
}
