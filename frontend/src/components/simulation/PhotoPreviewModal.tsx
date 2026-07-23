import demoTattoo from "../../assets/images/demo-tattoo.png";
import DialogCard from "../ui/DialogCard";

type PhotoPreviewModalProps = {
	title: string;
	onClose: () => void;
};

export default function PhotoPreviewModal({
	title,
	onClose,
}: PhotoPreviewModalProps) {
	return (
		<DialogCard title={title} onClose={onClose}>
			<div className="overflow-hidden rounded-[12px]">
				<img src={demoTattoo} alt="촬영 결과" className="w-full object-cover" />
			</div>
			<button
				type="button"
				className="mt-4 h-[52px] w-full rounded-[50px] bg-brand text-[16px] font-semibold text-white transition hover:brightness-95">
				내 컴퓨터에 저장
			</button>
		</DialogCard>
	);
}
