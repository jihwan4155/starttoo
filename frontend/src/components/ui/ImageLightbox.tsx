type ImageLightboxProps = {
	src: string;
	alt: string;
	onClose: () => void;
};

export default function ImageLightbox({
	src,
	alt,
	onClose,
}: ImageLightboxProps) {
	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
			<button
				type="button"
				onClick={onClose}
				aria-label="닫기"
				className="absolute right-6 top-6 flex size-11 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
					<path
						d="M6 6l12 12M18 6 6 18"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
				</svg>
			</button>
			<img
				src={src}
				alt={alt}
				className="max-h-[85vh] max-w-[85vw] object-contain"
			/>
		</div>
	);
}
