import type { SavedDesign } from "../../types/designExtract";

type DesignThumbnailGridProps = {
	designs: SavedDesign[];
	onOpen: (design: SavedDesign) => void;
	onRemove: (designId: number) => void;
};

/** 마이페이지 도안 보관함 썸네일 그리드 */
export default function DesignThumbnailGrid({
	designs,
	onOpen,
	onRemove,
}: DesignThumbnailGridProps) {
	return (
		<div className="grid grid-cols-4 gap-4">
			{designs.map((design) => (
				<div key={design.id} className="group relative">
					<button
						type="button"
						onClick={() => onOpen(design)}
						aria-label="저장한 도안 보기"
						className="aspect-square w-full overflow-hidden rounded-[6px] bg-[#f5f5f5] transition hover:opacity-90">
						<img
							src={design.previewUrl}
							alt=""
							className="size-full object-contain"
						/>
					</button>
					<button
						type="button"
						aria-label="도안 삭제"
						onClick={() => onRemove(design.id)}
						className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity duration-200 hover:bg-black/70 group-hover:opacity-100">
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
							strokeLinecap="round"
							aria-hidden>
							<path d="M5 5l14 14M19 5L5 19" />
						</svg>
					</button>
				</div>
			))}
		</div>
	);
}
