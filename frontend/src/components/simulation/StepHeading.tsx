type StepHeadingProps = {
	step: number;
	description: string;
};

export default function StepHeading({ step, description }: StepHeadingProps) {
	return (
		<div className="mt-3 shrink-0 text-center">
			<p className="text-[20px] font-bold text-black">STEP {step}</p>
			<p className="mt-1 text-[14px] font-light leading-5 text-black/70">
				{description}
			</p>
		</div>
	);
}
