type UploadDropzoneActionsProps = {
	hint?: string;
	/** Shows an extra filled "도안 보관함에서 선택" button next to the (real) computer picker. */
	showLibraryButton?: boolean;
	onPick: () => void;
	/** 도안 보관함 버튼 클릭 핸들러 (showLibraryButton일 때만 사용) */
	onPickLibrary?: () => void;
};

export default function UploadDropzoneActions({
	hint,
	showLibraryButton = false,
	onPick,
	onPickLibrary,
}: UploadDropzoneActionsProps) {
	return (
		<div className="mt-3 shrink-0">
			<div className="flex justify-center gap-3">
				<button
					type="button"
					onClick={onPick}
					className={`h-[46px] min-w-[180px] rounded-[50px] text-[16px] font-semibold transition ${
						showLibraryButton
							? "border border-black/15 text-black hover:bg-black/5"
							: "bg-brand text-white hover:brightness-95"
					}`}>
					컴퓨터에서 선택
				</button>
				{showLibraryButton && (
					<button
						type="button"
						onClick={onPickLibrary}
						className="h-[46px] min-w-[180px] rounded-[50px] bg-brand px-6 text-[16px] font-semibold text-white transition hover:brightness-95">
						도안 보관함에서 선택
					</button>
				)}
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
