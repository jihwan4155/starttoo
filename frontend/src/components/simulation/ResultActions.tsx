import demoTattoo from "../../assets/images/demo-tattoo.png";

export default function ResultActions() {
	return (
		<div className="mt-8 flex justify-center">
			<a
				href={demoTattoo}
				download="starttoo-simulation.png"
				className="inline-flex h-[54px] min-w-[200px] items-center justify-center rounded-[50px] bg-brand text-[18px] font-semibold text-white transition hover:brightness-95">
				내 컴퓨터에 저장
			</a>
		</div>
	);
}
