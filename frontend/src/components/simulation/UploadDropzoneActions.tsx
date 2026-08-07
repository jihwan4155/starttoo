type UploadDropzoneActionsProps = {
	hint?: string;
	/**
	 * 도안 단계 — 도안 보관함에서만 고르게 한다.
	 *
	 * <p>시뮬레이션에 얹을 도안은 보관함에 있는 것만 쓴다. 컴퓨터에서 아무 이미지나
	 * 올리면 배경이 붙은 사진이 그대로 얹혀 합성 결과가 깨진다.
	 */
	libraryOnly?: boolean;
	/** 컴퓨터에서 이미지 선택 (libraryOnly가 아닐 때만 사용) */
	onPick?: () => void;
	/** 도안 보관함 열기 (libraryOnly일 때만 사용) */
	onPickLibrary?: () => void;
};

export default function UploadDropzoneActions({
	hint,
	libraryOnly = false,
	onPick,
	onPickLibrary,
}: UploadDropzoneActionsProps) {
	return (
		<div className="mt-3 shrink-0">
			<div className="flex justify-center gap-3">
				<button
					type="button"
					onClick={libraryOnly ? onPickLibrary : onPick}
					className="h-[46px] min-w-[180px] rounded-[50px] bg-brand px-6 text-[16px] font-semibold text-white transition hover:brightness-95">
					{libraryOnly ? "도안 보관함에서 선택" : "컴퓨터에서 선택"}
				</button>
			</div>

			<p
				className={`mt-2 text-center text-[13px] font-light text-black/50 ${
					hint ? "" : "invisible"
				}`}>
				{hint || "placeholder"}
			</p>
		</div>
	);
}
