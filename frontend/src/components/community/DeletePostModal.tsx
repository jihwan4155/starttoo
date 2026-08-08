import { createPortal } from "react-dom";
import useBackClose from "../../hooks/useBackClose";

type DeletePostModalProps = {
	isOpen: boolean;
	caption: string;
	imageUrl?: string | null;
	onClose: () => void;
	onConfirm: () => void;
	isPending?: boolean;
};

function TrashIcon() {
	return (
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
	);
}

/** 피드 삭제 확인 */
export default function DeletePostModal({
	isOpen,
	caption,
	imageUrl,
	onClose,
	onConfirm,
	isPending = false,
}: DeletePostModalProps) {
	// 뒤로가기는 페이지를 떠나는 대신 이 창만 닫는다
	useBackClose(isOpen, onClose);

	if (!isOpen) return null;

	const preview =
		caption.trim().length > 80
			? `${caption.trim().slice(0, 80)}…`
			: caption.trim();

	// z-[120]: 피드 상세(80)·작성(90) 위에서 열리는 확인 계층
	return createPortal(
		<div
			className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-6 backdrop-blur-[2px]"
			onClick={onClose}
			role="presentation">
			{/* 낮은 화면(모바일 가로·작은 폰)에서 확인 버튼이 화면 밖으로 밀리지 않게 스크롤 */}
			<div
				className="relative max-h-full w-full max-w-[360px] overflow-y-auto rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="게시물 삭제 확인">
				<div className="h-14 bg-gradient-to-r from-brand/12 via-brand/5 to-transparent" />

				<div className="px-6 pb-6 pt-2">
					<div className="mx-auto -mt-8 flex size-14 items-center justify-center rounded-full border-4 border-white bg-brand/10 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
						<TrashIcon />
					</div>

					<p className="mt-4 text-center text-[18px] font-bold text-black">
						게시물을 삭제할까요?
					</p>
					<p className="mt-2 text-center text-[13px] font-light leading-5 text-black/50">
						삭제한 게시물은 복구할 수 없습니다.
					</p>

					<div className="mt-4 overflow-hidden rounded-[12px] border border-black/[0.06] bg-black/[0.02]">
						{imageUrl && (
							<div className="aspect-[4/3] w-full bg-[#D9D9D9]">
								<img
									src={imageUrl}
									alt=""
									className="size-full object-cover"
								/>
							</div>
						)}
						{preview ? (
							<p className="px-4 py-3 text-[13px] font-light leading-5 text-black/70">
								{preview}
							</p>
						) : (
							!imageUrl && (
								<p className="px-4 py-3 text-[13px] font-light text-black/40">
									문구 없음
								</p>
							)
						)}
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
