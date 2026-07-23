import { createPortal } from "react-dom";

type ImageViewerModalProps = {
	src: string;
	alt?: string;
	isOpen: boolean;
	onClose: () => void;
};

export default function ImageViewerModal({
	src,
	alt = "",
	isOpen,
	onClose,
}: ImageViewerModalProps) {
	if (!isOpen) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
			onClick={onClose}
			role="presentation">
			<div
				className="relative flex max-h-[85vh] w-full max-w-[1200px] items-center justify-center overflow-hidden rounded-2xl bg-[#1c1c1c]"
				onClick={(e) => e.stopPropagation()}
				role="presentation">
				<img
					src={src}
					alt={alt}
					className="max-h-[85vh] w-auto object-contain"
				/>
				<button
					type="button"
					aria-label="닫기"
					onClick={onClose}
					className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/10">
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
