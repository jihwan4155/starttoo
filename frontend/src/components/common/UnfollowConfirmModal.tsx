import { createPortal } from "react-dom";

type UnfollowConfirmModalProps = {
	isOpen: boolean;
	nickname: string;
	avatarUrl: string;
	onClose: () => void;
	onConfirm: () => void;
	isPending?: boolean;
};

/** 팔로우 취소 확인 카드 */
export default function UnfollowConfirmModal({
	isOpen,
	nickname,
	avatarUrl,
	onClose,
	onConfirm,
	isPending = false,
}: UnfollowConfirmModalProps) {
	if (!isOpen) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-[2px]"
			onClick={onClose}
			role="presentation">
			<div
				className="relative w-full max-w-[360px] overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="팔로우 취소 확인">
				<div className="h-16 bg-gradient-to-r from-brand/15 via-brand/5 to-transparent" />

				<div className="-mt-10 flex flex-col items-center px-6 pb-6 pt-0">
					<img
						src={avatarUrl}
						alt=""
						className="size-20 rounded-full border-4 border-white bg-[#D9D9D9] object-cover shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
					/>

					<p className="mt-4 text-center text-[18px] font-bold text-black">
						{nickname}
					</p>
					<p className="mt-3 text-center text-[15px] font-semibold leading-6 text-black">
						정말 팔로우를 취소하시겠습니까?
					</p>
					<p className="mt-2 text-center text-[13px] font-light leading-5 text-black/50">
						팔로우를 취소하면 이 사용자의 피드가
						<br />
						더 이상 표시되지 않습니다.
					</p>

					<div className="mt-8 flex w-full gap-3">
						<button
							type="button"
							onClick={onClose}
							disabled={isPending}
							className="h-11 flex-1 rounded-full border border-black/15 bg-white text-[14px] font-semibold text-black transition hover:bg-black/5 disabled:opacity-50">
							계속 팔로잉
						</button>
						<button
							type="button"
							onClick={onConfirm}
							disabled={isPending}
							className="h-11 flex-1 rounded-full bg-brand text-[14px] font-semibold text-white transition hover:brightness-95 disabled:opacity-50">
							{isPending ? "처리 중…" : "팔로우 취소"}
						</button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}
