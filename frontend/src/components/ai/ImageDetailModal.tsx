import useBackClose from "../../hooks/useBackClose";

type ImageDetailModalProps = {
	imageUrl: string;
	onClose: () => void;
};

function CloseIcon() {
	return (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
			<path
				d="M6 6l12 12M18 6 6 18"
				stroke="#1A1A1A"
				strokeWidth="2.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export default function ImageDetailModal({ imageUrl, onClose }: ImageDetailModalProps) {
	// 이 컴포넌트는 열릴 때만 마운트된다 — 뒤로가기로 닫는다
	useBackClose(true, onClose);

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1A1A1A]"
			onClick={onClose}
			role="presentation">
			<button
				type="button"
				onClick={onClose}
				aria-label="닫기"
				className="fixed right-8 top-8 flex size-11 items-center justify-center rounded-full bg-white transition hover:bg-gray-100">
				<CloseIcon />
			</button>

			<img
				src={imageUrl}
				alt="생성된 도안 상세"
				onClick={(event) => event.stopPropagation()}
				className="max-h-[92vh] max-w-[min(90vw,720px)] rounded-[10px] object-contain"
			/>
		</div>
	);
}
