type StepHeaderProps = {
	description: string;
};

/** 단계 안내. STEP 번호는 표기하지 않고 해야 할 일만 보여준다 */
export default function StepHeader({ description }: StepHeaderProps) {
	// shrink-0: 아래 캔버스 영역이 flex-1로 늘어날 때 이 문구가 눌리지 않게 한다
	return (
		<div className="mt-3 shrink-0 text-center">
			<p className="text-[15px] font-light leading-5 text-black/70">
				{description}
			</p>
		</div>
	);
}
