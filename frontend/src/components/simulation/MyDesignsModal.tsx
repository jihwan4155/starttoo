import demoTattoo from "../../assets/images/demo-tattoo.png";
import DialogCard from "../ui/DialogCard";

const SLOT_COUNT = 11;

type MyDesignsModalProps = {
	onClose: () => void;
};

export default function MyDesignsModal({ onClose }: MyDesignsModalProps) {
	return (
		<DialogCard title="내 도안보관함" onClose={onClose}>
			<div className="grid max-h-[360px] grid-cols-4 gap-4 overflow-y-auto pr-1">
				<button
					type="button"
					className="aspect-square overflow-hidden rounded-[8px]">
					<img
						src={demoTattoo}
						alt="보관된 도안"
						className="size-full object-cover"
					/>
				</button>
				{Array.from({ length: SLOT_COUNT }, (_, index) => (
					<div
						key={index}
						className="aspect-square rounded-[8px] bg-black/10"
					/>
				))}
			</div>
		</DialogCard>
	);
}
