import demoTattoo from "../../assets/images/demo-tattoo.png";

type ArResultStepProps = {
	/** 처음으로 돌아가 다시 시작 */
	onRestart: () => void;
};

/**
 * PC 마지막 단계 — 폰에서 캡처한 결과를 수신해 미리보고 저장한다.
 * 지금은 목업(데모 이미지) — 이후 세션 소켓의 capture-ready로 실제 이미지를 받는다.
 */
export default function ArResultStep({ onRestart }: ArResultStepProps) {
	return (
		<div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-4">
			<div className="relative w-full max-w-[240px] overflow-hidden rounded-[16px] bg-black/5 ring-1 ring-black/5">
				<span className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-semibold text-black/60">
					폰에서 캡처한 결과
				</span>
				<img
					src={demoTattoo}
					alt="AR 캡처 결과"
					className="w-full object-cover"
				/>
			</div>

			<div className="flex w-full max-w-[280px] flex-col gap-2">
				<button
					type="button"
					className="h-[52px] w-full rounded-[50px] bg-brand text-[16px] font-semibold text-white transition hover:brightness-95">
					내 컴퓨터에 저장
				</button>
				<button
					type="button"
					onClick={onRestart}
					className="h-[44px] w-full text-[14px] font-semibold text-black/40 transition hover:text-black/60">
					처음부터 다시 하기
				</button>
			</div>
		</div>
	);
}
