import DialogCard from "../ui/DialogCard";
import useDesignStore from "../../store/useDesignStore";
import type { SavedDesign } from "../../types/designExtract";

type MyDesignsModalProps = {
	onClose: () => void;
	/** 도안 선택 시 호출 (미지정 시 클릭해도 선택 동작 없음) */
	onSelect?: (design: SavedDesign) => void;
};

export default function MyDesignsModal({
	onClose,
	onSelect,
}: MyDesignsModalProps) {
	// 내 도안 보관함(도안 추출 저장분) — localStorage 영속
	const savedDesigns = useDesignStore((s) => s.savedDesigns);

	return (
		<DialogCard title="내 도안보관함" onClose={onClose}>
			{savedDesigns.length === 0 ? (
				<div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
					<p className="text-[15px] font-semibold text-black">
						보관된 도안이 없어요
					</p>
					<p className="text-[13px] font-light leading-5 text-black/50">
						게시글에서 도안을 추출하면
						<br />
						내 도안보관함에 저장됩니다.
					</p>
				</div>
			) : (
				<div className="grid max-h-[min(360px,60vh)] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 sm:gap-4">
					{savedDesigns.map((design) => (
						<button
							key={design.id}
							type="button"
							onClick={() => onSelect?.(design)}
							className="aspect-square overflow-hidden rounded-[8px] border-2 border-transparent transition hover:border-brand">
							<img
								src={design.previewUrl}
								alt="보관된 도안"
								className="size-full object-cover"
							/>
						</button>
					))}
				</div>
			)}
		</DialogCard>
	);
}
