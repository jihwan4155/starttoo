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
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-3 sm:px-6"
			onClick={onClose}
			role="presentation">
			<div
				className="relative w-full max-w-[480px] rounded-[16px] bg-white px-4 pb-6 pt-10 sm:rounded-[20px] sm:px-10 sm:py-12"
				onClick={(event) => event.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="저장 완료">
				<button
					type="button"
					onClick={onClose}
					aria-label="닫기"
					className="absolute right-3 top-3 flex size-8 items-center justify-center sm:right-5 sm:top-5">
					<CloseIcon />
				</button>

				<p className="text-center text-[21px] font-bold leading-7 text-black sm:text-[28px] sm:leading-8">
					저장되었습니다
				</p>

				<div className="mt-7 grid grid-cols-2 gap-2 sm:mt-10 sm:gap-4">
					<Link
						to="/mypage?tab=designs"
						onClick={onClose}
						className="inline-flex h-12 min-w-0 items-center justify-center rounded-[50px] border border-black bg-white px-2 text-[14px] font-semibold text-black transition hover:bg-gray-50 sm:h-[52px] sm:min-w-[140px] sm:px-6 sm:text-[18px]">
						보관함 가기
					</Link>
					<Link
						to="/simulations"
						onClick={onClose}
						className="inline-flex h-12 min-w-0 items-center justify-center rounded-[50px] bg-brand px-2 text-[14px] font-semibold text-white transition hover:brightness-95 sm:h-[52px] sm:min-w-[140px] sm:px-6 sm:text-[18px]">
						시뮬레이션 보기
					</Link>
				</div>
			</div>
		</div>
	);
}
