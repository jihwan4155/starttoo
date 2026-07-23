import { useState } from "react";
import demoTattoo from "../../assets/images/demo-tattoo.png";
import ImageLightbox from "../ui/ImageLightbox";

function ZoomIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
			<circle cx="11" cy="11" r="7" stroke="#ffffff" strokeWidth="1.8" />
			<path
				d="M21 21l-4.3-4.3"
				stroke="#ffffff"
				strokeWidth="1.8"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export default function ResultImage() {
	const [zoomOpen, setZoomOpen] = useState(false);

	return (
		<>
			<div className="relative mx-auto aspect-[16/9] w-full max-w-[700px] overflow-hidden rounded-[12px] bg-black/5">
				<img
					src={demoTattoo}
					alt="합성 결과"
					className="size-full object-cover"
				/>
				<button
					type="button"
					onClick={() => setZoomOpen(true)}
					aria-label="이미지 확대"
					className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full bg-black/70 transition hover:bg-black">
					<ZoomIcon />
				</button>
			</div>

			{zoomOpen && (
				<ImageLightbox
					src={demoTattoo}
					alt="합성 결과 확대"
					onClose={() => setZoomOpen(false)}
				/>
			)}
		</>
	);
}
