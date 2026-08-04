import DialogCard from "../ui/DialogCard";
import StarttooLoader from "../loader/StarttooLoader";
import useArchive from "../../hooks/queries/useArchive";
import { ApiError } from "../../services/api";
import { mapArchiveItemToSavedDesign } from "../../utils/mapArchive";
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
	// 내 도안 보관함 — 마이페이지와 같은 서버 보관함(GET /archive)을 읽는다.
	// 이전에는 localStorage(useDesignStore)를 읽었는데, 저장된 previewUrl이
	// 도안 추출 로컬 서버(127.0.0.1) 주소라 폰 등 다른 기기에서 전부 깨졌다.
	const { data, isPending, isError, error } = useArchive({ size: 30 });
	const savedDesigns =
		data?.pages.flatMap((page) => page.items.map(mapArchiveItemToSavedDesign)) ??
		[];

	const errorMessage =
		error instanceof ApiError ? error.message : "보관함을 불러오지 못했습니다.";

	return (
		<DialogCard title="내 도안보관함" onClose={onClose}>
			{isPending ? (
				<div className="flex h-[220px] items-center justify-center">
					<StarttooLoader variant="block" size={170} label="보관함을 불러오는 중…" />
				</div>
			) : isError ? (
				<p className="flex h-[220px] items-center justify-center text-center text-[13px] text-black/60">
					{errorMessage}
				</p>
			) : savedDesigns.length === 0 ? (
				<div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
					<p className="text-[15px] font-semibold text-black">
						보관된 도안이 없어요
					</p>
					<p className="text-[13px] font-light leading-5 text-black/50">
						게시글에서 도안을 보관함에 저장하면
						<br />
						여기에서 선택할 수 있어요.
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
