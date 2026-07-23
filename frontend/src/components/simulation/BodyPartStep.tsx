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
			<button
				type="button"
				onClick={() => onSelect("back")}
				aria-pressed={selected === "back"}
				aria-label="등 선택"
				className={`absolute inset-y-0 right-0 w-1/2 rounded-r-[16px] transition ${
					selected === "back" ? "ring-4 ring-inset ring-brand" : ""
				}`}
			/>
		</div>
	);
}
