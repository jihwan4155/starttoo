import StarttooLoader from "../loader/StarttooLoader";
import type { SavedDesign } from "../../types/designExtract";
import type { ArchiveDragPayload } from "../../types/collection";
import { ARCHIVE_DRAG_MIME } from "../../constants/collectionDrag";
import { isDemoArchiveDesign } from "../../constants/demoArchiveDesigns";
import useCollectionStore from "../../store/useCollectionStore";
import { isMannequinView } from "../../types/collection";

type CollectionArchivePanelProps = {
	designs: SavedDesign[];
	isLoading?: boolean;
	disabled?: boolean;
	variant?: "sidebar" | "floating";
	userId?: number;
};

/** 도안 보관함의 도안 — 마네킹 캔버스로 드래그 */
export default function CollectionArchivePanel({
	designs,
	isLoading = false,
	disabled = false,
	variant = "sidebar",
	userId,
}: CollectionArchivePanelProps) {
	const editorView = useCollectionStore((s) => s.editorView);
	const addPlacement = useCollectionStore((s) => s.addPlacement);

	const handleMobileAdd = (design: SavedDesign) => {
		if (disabled || userId == null || !window.matchMedia("(max-width: 1023px)").matches) return;
		addPlacement(userId, {
			tattooId: design.id,
			imageSeq: design.imageSeq,
			imageUrl: design.previewUrl,
			bodyPart: "torso",
			view: isMannequinView(editorView) ? editorView : "front",
			x: 0.5,
			y: 0.44,
			scale: 0.18,
			rotation: 0,
			flipX: false,
		});
	};
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
					? "z-[45] mt-5 w-full lg:fixed lg:right-4 lg:top-1/2 lg:mt-0 lg:w-[236px] lg:max-h-[calc(100vh-80px)] lg:-translate-y-1/2 lg:overflow-hidden lg:rounded-[12px] lg:border lg:border-black/10 lg:bg-white lg:shadow-[0_8px_32px_rgba(0,0,0,0.1)]"
					: `w-[220px] shrink-0 ${disabled ? "opacity-50" : ""}`
			}>
			<div
				className={
					isFloating
						? "bg-white px-4 py-3 lg:flex lg:max-h-[calc(100vh-80px)] lg:flex-col lg:rounded-[12px] lg:p-4"
						: "rounded-[8px] border border-black/10 bg-white p-4"
				}>
				<h3 className="text-[15px] font-semibold text-black">도안 보관함</h3>
				<p className="mt-1 text-[12px] leading-relaxed text-black/45">
					{disabled
						? "수정 모드에서 도안을 배치할 수 있습니다"
						: <><span className="lg:hidden">도안을 누르면 마네킹에 추가돼요</span><span className="hidden lg:inline">도안을 마네킹 위로 드래그해 배치하세요</span></>}
				</p>

				{isLoading ? (
					<StarttooLoader variant="block" size={150} className="mt-2" />
				) : designs.length === 0 ? (
					<p className="mt-6 text-center text-[13px] leading-relaxed text-black/40">
						저장한 도안이 없습니다.
						<br />
						「도안 보관함」 탭에서 먼저 저장해 주세요.
					</p>
				) : (
					<ul
						className={`mt-4 ${isFloating ? "flex gap-2 overflow-x-auto pb-1 lg:block lg:max-h-[420px] lg:min-h-0 lg:flex-1 lg:space-y-2 lg:overflow-y-auto lg:pr-1" : "max-h-[520px] space-y-2 overflow-y-auto pr-1"}`}>
						{designs.map((design) => (
							<li key={design.id} className={isFloating ? "shrink-0 lg:shrink" : undefined}>
								<button
									type="button"
									draggable={!disabled}
									disabled={disabled}
									onDragStart={(event) => handleDragStart(event, design)}
									onClick={() => handleMobileAdd(design)}
									className={`flex cursor-grab items-center gap-3 rounded-[6px] border border-black/8 bg-[#fafafa] p-2 text-left transition hover:border-black/20 hover:bg-white active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-60 ${isFloating ? "w-[82px] flex-col lg:w-full lg:flex-row" : "w-full"}`}>
									<img
										src={design.previewUrl}
										alt=""
										className={`${isFloating ? "size-16 lg:size-12" : "size-12"} shrink-0 rounded-[4px] bg-transparent object-contain mix-blend-multiply`}
										draggable={false}
									/>
									<div className={`min-w-0 ${isFloating ? "hidden lg:block" : ""}`}>
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
