import type { SavedDesign } from "../../types/designExtract";
import { isDemoArchiveDesign } from "../../constants/demoArchiveDesigns";

type DesignThumbnailGridProps = {
	designs: SavedDesign[];
	onOpen: (design: SavedDesign) => void;
	onRemove: (designId: number) => void;
	removeDisabled?: boolean;
};

/** 마이페이지 도안 보관함 썸네일 그리드 */
export default function DesignThumbnailGrid({
	designs,
	onOpen,
	onRemove,
	removeDisabled = false,
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
							className="size-full object-contain mix-blend-multiply"
						/>
					</button>
					{!isDemoArchiveDesign(design.id) && (
						<button
							type="button"
							aria-label="도안 삭제"
							disabled={removeDisabled}
							onClick={() => onRemove(design.id)}
							className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity duration-200 hover:bg-black/70 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40">
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
					)}
					{isDemoArchiveDesign(design.id) && (
						<span className="absolute left-2 top-2 rounded-[4px] bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
							샘플
						</span>
					)}
				</div>
			))}
		</div>
	);
}
