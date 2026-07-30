import arBody from "../../assets/images/ar-body.png";

export type BodyPart = "arm" | "back";

type BodyPartStepProps = {
	selected: BodyPart | null;
	onSelect: (part: BodyPart) => void;
};

export default function BodyPartStep({
	selected,
	onSelect,
}: BodyPartStepProps) {
	return (
		<div className="relative mx-auto aspect-[649/400] h-full max-h-[400px] w-auto max-w-[700px] overflow-hidden rounded-[16px] bg-white">
			<img
				src={arBody}
				alt="신체 부위 선택 가이드 (팔, 등)"
				className="size-full object-contain"
			/>

			<button
				type="button"
				onClick={() => onSelect("arm")}
				aria-pressed={selected === "arm"}
				aria-label="팔 선택"
				className={`absolute inset-y-0 left-0 w-1/2 rounded-l-[16px] transition ${
					selected === "arm" ? "ring-4 ring-inset ring-brand" : ""
				}`}
			/>
			{/* 현재 AR은 '팔'만 지원 — 등은 준비 중으로 비활성 */}
			<div
				aria-label="등 (준비 중)"
				className="absolute inset-y-0 right-0 flex w-1/2 cursor-not-allowed items-end justify-center rounded-r-[16px] bg-black/[0.04]">
				<span className="mb-4 rounded-full bg-black/60 px-3 py-1 text-[12px] font-semibold text-white">
					준비 중
				</span>
			</div>
		</div>
	);
}
