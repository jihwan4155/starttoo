import demoTattoo from "../../assets/images/demo-tattoo.png";

export default function ResultActions() {
	return (
		<div className="mt-3 shrink-0">
			<div className="flex justify-center">
				<a
					href={demoTattoo}
					download="starttoo-simulation.png"
					className="inline-flex h-[46px] min-w-[180px] items-center justify-center rounded-[50px] bg-brand text-[16px] font-semibold text-white transition hover:brightness-95">
					내 컴퓨터에 저장
				</a>
			</div>
			<p className="invisible mt-2 text-center text-[13px] font-light text-black/50">
				placeholder
			</p>
		</div>
	);
}
