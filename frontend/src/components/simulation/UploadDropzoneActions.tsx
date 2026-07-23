type UploadDropzoneActionsProps = {
	hint?: string;
	/** Shows an extra filled "보관함에서 선택" button next to the (real) computer picker. */
	showLibraryButton?: boolean;
	onPick: () => void;
};

export default function UploadDropzoneActions({
	hint,
	showLibraryButton = false,
	onPick,
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
						className="h-[46px] min-w-[180px] rounded-[50px] bg-brand text-[16px] font-semibold text-white transition hover:brightness-95">
						보관함에서 선택
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
