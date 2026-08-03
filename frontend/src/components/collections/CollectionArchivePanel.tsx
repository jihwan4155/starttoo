import type { SavedDesign } from "../../types/designExtract";
import type { ArchiveDragPayload } from "../../types/collection";
import { ARCHIVE_DRAG_MIME } from "../../constants/collectionDrag";
import { isDemoArchiveDesign } from "../../constants/demoArchiveDesigns";

type CollectionArchivePanelProps = {
	designs: SavedDesign[];
	isLoading?: boolean;
	disabled?: boolean;
	variant?: "sidebar" | "floating";
};

/** 보관함 도안 — 마네킹 캔버스로 드래그 */
export default function CollectionArchivePanel({
	designs,
	isLoading = false,
	disabled = false,
	variant = "sidebar",
}: CollectionArchivePanelProps) {
	const handleDragStart = (
		event: React.DragEvent<HTMLButtonElement>,
		design: SavedDesign,
	) => {
		if (disabled) {
			event.preventDefault();
			return;
		}
		const payload: ArchiveDragPayload = {
			tattooId: design.id,
			imageUrl: design.previewUrl,
			imageSeq: design.imageSeq,
		};
		event.dataTransfer.setData(
			ARCHIVE_DRAG_MIME,
			JSON.stringify(payload),
		);
		event.dataTransfer.effectAllowed = "copy";
	};

	const isFloating = variant === "floating";

	return (
		<aside
			className={
				isFloating
					? "z-[9998] w-full max-lg:mt-6 lg:fixed lg:right-4 lg:top-1/2 lg:w-[236px] lg:max-h-[calc(100vh-80px)] lg:-translate-y-1/2 lg:overflow-hidden lg:rounded-[12px] lg:border lg:border-black/10 lg:bg-white lg:shadow-[0_8px_32px_rgba(0,0,0,0.1)]"
					: `w-[220px] shrink-0 ${disabled ? "opacity-50" : ""}`
			}>
			<div
				className={
					isFloating
						? "p-4 max-lg:rounded-[12px] max-lg:border max-lg:border-black/10 max-lg:bg-white max-lg:shadow-[0_8px_32px_rgba(0,0,0,0.1)] lg:flex lg:max-h-[calc(100vh-80px)] lg:flex-col"
						: "rounded-[8px] border border-black/10 bg-white p-4"
				}>
				<h3 className="text-[15px] font-semibold text-black">보관함 도안</h3>
				<p className="mt-1 text-[12px] leading-relaxed text-black/45">
					{disabled
						? "수정 모드에서 도안을 배치할 수 있습니다"
						: "도안을 마네킹 위로 드래그해 배치하세요"}
				</p>

				{isLoading ? (
					<p className="mt-6 text-center text-[13px] text-black/40">
						불러오는 중…
					</p>
				) : designs.length === 0 ? (
					<p className="mt-6 text-center text-[13px] leading-relaxed text-black/40">
						저장한 도안이 없습니다.
						<br />
						「도안 보관함」 탭에서 먼저 저장해 주세요.
					</p>
				) : (
					<ul
						className={`mt-4 space-y-2 overflow-y-auto pr-1 ${isFloating ? "max-h-[420px] lg:min-h-0 lg:flex-1" : "max-h-[520px]"}`}>
						{designs.map((design) => (
							<li key={design.id}>
								<button
									type="button"
									draggable={!disabled}
									disabled={disabled}
									onDragStart={(event) => handleDragStart(event, design)}
									className="flex w-full cursor-grab items-center gap-3 rounded-[6px] border border-black/8 bg-[#fafafa] p-2 text-left transition hover:border-black/20 hover:bg-white active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-60">
									<img
										src={design.previewUrl}
										alt=""
										className="size-12 shrink-0 rounded-[4px] bg-transparent object-contain mix-blend-multiply"
										draggable={false}
									/>
									<div className="min-w-0">
										<span className="block text-[12px] text-black/60">
											{isDemoArchiveDesign(design.id)
												? design.id === -1
													? "샘플 · 고양이"
													: "샘플 · 트라이벌"
												: `도안 #${design.id}`}
										</span>
									</div>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</aside>
	);
}
