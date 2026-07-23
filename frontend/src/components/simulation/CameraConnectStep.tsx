function QrGlyph() {
	return (
		<svg width="230" height="230" viewBox="0 0 110 110" fill="none" aria-hidden>
			<rect
				x="4"
				y="4"
				width="30"
				height="30"
				rx="4"
				stroke="#111111"
				strokeWidth="6"
			/>
			<rect
				x="76"
				y="4"
				width="30"
				height="30"
				rx="4"
				stroke="#111111"
				strokeWidth="6"
			/>
			<rect
				x="4"
				y="76"
				width="30"
				height="30"
				rx="4"
				stroke="#111111"
				strokeWidth="6"
			/>
			<rect x="14" y="14" width="10" height="10" fill="#111111" />
			<rect x="86" y="14" width="10" height="10" fill="#111111" />
			<rect x="14" y="86" width="10" height="10" fill="#111111" />
			<rect x="48" y="4" width="8" height="8" fill="#111111" />
			<rect x="48" y="20" width="8" height="8" fill="#111111" />
			<rect x="64" y="36" width="8" height="8" fill="#111111" />
			<rect x="48" y="48" width="8" height="8" fill="#111111" />
			<rect x="64" y="48" width="8" height="8" fill="#111111" />
			<rect x="48" y="64" width="8" height="8" fill="#111111" />
			<rect x="80" y="64" width="8" height="8" fill="#111111" />
			<rect x="96" y="80" width="8" height="8" fill="#111111" />
			<rect x="48" y="80" width="8" height="8" fill="#111111" />
			<rect x="64" y="96" width="8" height="8" fill="#111111" />
			<rect x="80" y="96" width="8" height="8" fill="#111111" />
		</svg>
	);
}

export default function CameraConnectStep() {
	return (
		<div className="mx-auto flex aspect-[16/9] w-full max-w-[700px] items-center justify-center rounded-[16px] bg-white">
			<div className="flex size-[270px] items-center justify-center rounded-[12px] border border-black/10">
				<QrGlyph />
			</div>
		</div>
	);
}
