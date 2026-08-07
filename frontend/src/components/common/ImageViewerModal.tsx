import { createPortal } from "react-dom";
import useBackClose from "../../hooks/useBackClose";

type ImageViewerModalProps = {
	src: string;
	alt?: string;
	isOpen: boolean;
	onClose: () => void;
	/**
	 * 배경 톤.
	 *
	 * 사진은 검은 바탕이 잘 어울리지만, 배경이 비어 있는 도안 PNG는 검은 바탕에
	 * 올리면 검은 선이 묻혀 보이지 않는다. "light"는 도안 보관함 썸네일과 같은 흰
	 * 바탕에 얹어 목록에서 보던 그대로 보여준다.
	 */
	variant?: "dark" | "light";
};

export default function ImageViewerModal({
	src,
	alt = "",
	isOpen,
	onClose,
	variant = "dark",
}: ImageViewerModalProps) {
	// 뒤로가기는 페이지를 떠나는 대신 이 창만 닫는다
	useBackClose(isOpen, onClose);

	if (!isOpen) return null;

	const isLight = variant === "light";

	return createPortal(
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
			onClick={onClose}
			role="presentation">
			<div
				className={`relative flex max-h-[85vh] items-center justify-center overflow-hidden rounded-2xl ${
					isLight
						? "w-auto max-w-[min(90vw,900px)] bg-[#f5f5f5] p-6"
						: "w-full max-w-[1200px] bg-[#1c1c1c]"
				}`}
				onClick={(e) => e.stopPropagation()}
				role="presentation">
				<img
					src={src}
					alt={alt}
					className={
						isLight
							? "max-h-[73vh] w-auto max-w-full object-contain mix-blend-multiply"
							: "max-h-[85vh] w-auto object-contain"
					}
				/>
				<button
					type="button"
					aria-label="닫기"
					onClick={onClose}
					className={`absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full transition ${
						isLight
							? "text-black/50 hover:bg-black/5 hover:text-black"
							: "text-white hover:bg-white/10"
					}`}>
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						strokeLinecap="round">
						<path d="M5 5l14 14M19 5L5 19" />
					</svg>
				</button>
			</div>
		</div>,
		document.body,
	);
}
