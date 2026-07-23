type StepHeaderProps = {
	step: number;
	description: string;
};

export default function StepHeader({ step, description }: StepHeaderProps) {
	return (
		<div className="text-center">
			<p className="text-[22px] font-bold text-black">STEP {step}</p>
			<p className="mt-2 text-[15px] font-light leading-6 text-black/70">
				{description}
			</p>
		</div>
	);
}
