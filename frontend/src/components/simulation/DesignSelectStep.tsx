import demoTattoo from "../../assets/images/demo-tattoo.png";

const DESIGN_COUNT = 5;

type DesignSelectStepProps = {
	selectedIndex: number;
	onSelect: (index: number) => void;
	onAddDesign: () => void;
	onCapture: () => void;
};

function CameraIcon() {
	return (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
			<path
				d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
				stroke="#ffffff"
				strokeWidth="1.6"
				strokeLinejoin="round"
			/>
			<circle cx="12" cy="13.5" r="3.2" stroke="#ffffff" strokeWidth="1.6" />
		</svg>
	);
}

export default function DesignSelectStep({
	selectedIndex,
	onSelect,
	onAddDesign,
	onCapture,
}: DesignSelectStepProps) {
	return (
		<div className="mx-auto flex w-full max-w-[480px] flex-col gap-4 sm:flex-row">
			<div className="relative mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded-[12px] bg-black/5">
				<span className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[13px] font-semibold text-brand">
					<span className="size-[6px] rounded-full bg-brand" />
					LIVE
				</span>
				<img
					src={demoTattoo}
					alt="실시간 타투 프리뷰"
					className="size-full object-cover"
				/>
				<button
					type="button"
					onClick={onCapture}
					aria-label="사진 촬영"
					className="absolute bottom-3 right-3 flex size-11 items-center justify-center rounded-full bg-black/70 transition hover:bg-black">
					<CameraIcon />
				</button>
			</div>

			<div className="w-full max-w-[220px] rounded-[12px] bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
				<div className="grid grid-cols-2 gap-2">
					{Array.from({ length: DESIGN_COUNT }, (_, index) => (
						<button
							key={index}
							type="button"
							onClick={() => onSelect(index)}
							aria-pressed={selectedIndex === index}
							className={`aspect-square overflow-hidden rounded-[10px] border-2 ${
								selectedIndex === index ? "border-brand" : "border-transparent"
							}`}>
							<img
								src={demoTattoo}
								alt={`도안 ${index + 1}`}
								className="size-full object-cover"
							/>
						</button>
					))}
					<button
						type="button"
						onClick={onAddDesign}
						aria-label="도안 추가"
						className="flex aspect-square items-center justify-center rounded-[10px] border border-dashed border-black/20 text-[24px] text-black/40 transition hover:border-black/40 hover:text-black/60">
						+
					</button>
				</div>
			</div>
		</div>
	);
}
