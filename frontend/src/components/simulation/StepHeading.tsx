type StepHeadingProps = {
	description: string;
};

/** 단계 안내. STEP 번호는 표기하지 않고 해야 할 일만 보여준다 */
export default function StepHeading({ description }: StepHeadingProps) {
	return (
		<div className="mt-3 shrink-0 text-center">
			<p className="text-[15px] font-light leading-5 text-black/70">
				{description}
			</p>
		</div>
	);
}
