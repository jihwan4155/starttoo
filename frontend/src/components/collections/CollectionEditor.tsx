import useCollectionStore from "../../store/useCollectionStore";
import useDeselectPlacementOnOutsideClick from "../../hooks/useDeselectPlacementOnOutsideClick";
import type { SavedDesign } from "../../types/designExtract";
import CtaButton from "../ui/CtaButton";
import CollectionArchivePanel from "./CollectionArchivePanel";
import CollectionPreview from "./CollectionPreview";
import MannequinCanvas from "./MannequinCanvas";

type CollectionEditorProps = {
	userId: number;
	designs: SavedDesign[];
	isArchiveLoading?: boolean;
};

const collectionCtaClassName =
	"!h-auto !w-auto min-w-[132px] px-5 py-2.5 !text-[14px] !font-medium !leading-normal";

/** 내 컬렉션 — 미리보기 / 편집 모드 */
export default function CollectionEditor({
	userId,
	designs,
	isArchiveLoading = false,
}: CollectionEditorProps) {
	const isEditMode = useCollectionStore((s) => s.isEditMode);
	const saveCollection = useCollectionStore((s) => s.saveCollection);
	const enterEditMode = useCollectionStore((s) => s.enterEditMode);

	useDeselectPlacementOnOutsideClick(isEditMode);

	return (
		<div>
			{isEditMode ? (
				<>
					<div className="mx-auto max-w-[420px]">
						<MannequinCanvas userId={userId} />
						<div className="mt-6 flex justify-center">
							<CtaButton
								onClick={saveCollection}
								className={collectionCtaClassName}>
								저장하기
							</CtaButton>
						</div>
					</div>

					<CollectionArchivePanel
						designs={designs}
						isLoading={isArchiveLoading}
						variant="floating"
					/>
				</>
			) : (
				<>
					<CollectionPreview userId={userId} />
					<div className="mt-6 flex justify-center">
						<CtaButton
							onClick={enterEditMode}
							className={`${collectionCtaClassName} border border-black/20 !bg-white !text-black hover:!brightness-100 hover:bg-black/5`}>
							편집하기
						</CtaButton>
					</div>
				</>
			)}
		</div>
	);
}
