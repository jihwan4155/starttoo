type RoleAskStepProps = {
	/** 예 → 타투이스트, 아니요 → 일반 사용자 */
	onSelect: (isArtist: boolean) => void;
};

/**
 * 온보딩 1단계 — 역할 질문.
 *
 * 여기서 닫으면 가입 때 만들어진 그대로 일반 사용자로 남는다.
 */
export default function RoleAskStep({ onSelect }: RoleAskStepProps) {
	return (
		<div className="flex gap-3">
			<button
				type="button"
				onClick={() => onSelect(true)}
				className="h-[52px] flex-1 rounded-[10px] bg-brand text-[16px] font-semibold text-white transition hover:brightness-95">
				예
			</button>
			<button
				type="button"
				onClick={() => onSelect(false)}
				className="h-[52px] flex-1 rounded-[10px] border border-black/15 bg-white text-[16px] font-semibold text-black transition hover:bg-black/5">
				아니요
			</button>
		</div>
	);
}
