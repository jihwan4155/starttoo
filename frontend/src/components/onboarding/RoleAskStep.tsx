type RoleAskStepProps = {
	/** 예 → 타투이스트, 아니요 → 일반 사용자 */
	onSelect: (isArtist: boolean) => void;
	/** 가입 요청이 나가는 동안 다시 누르지 못하게 막는다 */
	disabled?: boolean;
};

/**
 * 역할 질문 — 가입을 마치기 직전 단계.
 *
 * users.role은 가입 요청에서만 정해지고 이후 바꾸는 API가 없어서 가입 전에
 * 물어야 한다. 고른 값이 그대로 signup 요청의 role이 된다.
 */
export default function RoleAskStep({ onSelect, disabled }: RoleAskStepProps) {
	return (
		<div className="flex gap-3">
			<button
				type="button"
				disabled={disabled}
				onClick={() => onSelect(true)}
				className="h-[52px] flex-1 rounded-[10px] bg-brand text-[16px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#FFB4B4]">
				예
			</button>
			<button
				type="button"
				disabled={disabled}
				onClick={() => onSelect(false)}
				className="h-[52px] flex-1 rounded-[10px] border border-black/15 bg-white text-[16px] font-semibold text-black transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50">
				아니요
			</button>
		</div>
	);
}
