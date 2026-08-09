import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { MAX_ARCHIVE_DESIGNS } from "../../constants/archive";
import useBackClose from "../../hooks/useBackClose";

type ArchiveFullModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

/**
 * 도안 보관함이 가득 찼을 때 — 저장을 막고 정리 화면으로 보낸다.
 * 추출/커버업 결과 모달 위에 떠야 해서 z-index를 높게 둔다.
 */
export default function ArchiveFullModal({ isOpen, onClose }: ArchiveFullModalProps) {
	const navigate = useNavigate();
	useBackClose(isOpen, onClose);

	if (!isOpen) return null;

	const goToArchive = () => {
		onClose();
		navigate("/mypage?tab=designs");
	};

	return createPortal(
		<div
			className="fixed inset-0 z-[140] flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
			onClick={onClose}
			role="presentation">
			<div
				className="relative w-full max-w-[420px] rounded-2xl bg-white px-5 pb-5 pt-10 shadow-xl sm:px-8 sm:pb-8 sm:pt-12"
				onClick={(event) => event.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-labelledby="archive-full-title">
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

				<p
					id="archive-full-title"
					className="text-center text-[20px] font-semibold text-black sm:text-[24px]">
					도안 보관함이 가득 찼어요
				</p>
				<p className="mt-3 text-center text-[14px] font-light leading-5 text-black/55 sm:text-[15px]">
					최대 {MAX_ARCHIVE_DESIGNS}개까지 저장할 수 있어요.
					<br />
					보관함에서 도안을 정리한 뒤 다시 시도해 주세요.
				</p>

				<div className="mt-7 grid grid-cols-2 gap-2 sm:mt-8 sm:gap-3">
					<button
						type="button"
						onClick={onClose}
						className="h-12 min-w-0 rounded-full border border-black/20 bg-white px-2 text-[14px] font-semibold text-black transition hover:bg-black/5 active:scale-[0.99] sm:h-[52px] sm:text-[16px]">
						닫기
					</button>
					<button
						type="button"
						onClick={goToArchive}
						className="h-12 min-w-0 rounded-full bg-brand px-2 text-[14px] font-semibold text-white transition hover:brightness-95 active:scale-[0.99] sm:h-[52px] sm:text-[16px]">
						도안 보관함 가기
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
