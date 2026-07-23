type StepHeadingProps = {
	step: number;
	description: string;
};

export default function StepHeading({ step, description }: StepHeadingProps) {
	return (
		<div className="mt-8 text-center">
			<p className="text-[22px] font-extrabold text-black">STEP {step}</p>
			<p className="mt-1 text-[15px] text-black/60">{description}</p>
		</div>
	);
}
