import { useState } from "react";
import useSaveCollection from "../../hooks/mutations/useSaveCollection";
import useMyCollections from "../../hooks/queries/useMyCollections";
import useCollectionStore from "../../store/useCollectionStore";
import useDeselectPlacementOnOutsideClick from "../../hooks/useDeselectPlacementOnOutsideClick";
import { ApiError } from "../../services/api";
import type { SavedDesign } from "../../types/designExtract";
import StarttooLoader from "../loader/StarttooLoader";
import CtaButton from "../ui/CtaButton";
import CollectionArchivePanel from "./CollectionArchivePanel";
import CollectionPreview from "./CollectionPreview";
import MannequinCanvas from "./MannequinCanvas";
import LoadingLabel from "../loader/LoadingLabel";

type CollectionEditorProps = {
	userId: number;
	designs: SavedDesign[];
	isArchiveLoading?: boolean;
};

const collectionCtaClassName =
	"!h-12 !w-[76%] max-w-[290px] px-5 py-2.5 !text-[16px] !font-semibold !leading-normal lg:!h-auto lg:!w-auto lg:min-w-[132px] lg:!text-[14px] lg:!font-medium";

/** 내 컬렉션 — 미리보기 / 편집 모드 (GET·POST·DELETE /collections) */
export default function CollectionEditor({
	userId,
	designs,
	isArchiveLoading = false,
}: CollectionEditorProps) {
	const isEditMode = useCollectionStore((s) => s.isEditMode);
	const exitEditMode = useCollectionStore((s) => s.saveCollection);
	const enterEditMode = useCollectionStore((s) => s.enterEditMode);
	const setPlacements = useCollectionStore((s) => s.setPlacements);
	const editorPlacements = useCollectionStore(
		(s) => s.byUser?.[String(userId)],
	);
	const [saveError, setSaveError] = useState<string | null>(null);

	const {
		data: savedPlacements,
		isPending: isLoadingSaved,
		isError: isSavedError,
	} = useMyCollections();
	const { mutateAsync: saveCollection, isPending: isSaving } =
		useSaveCollection();

	useDeselectPlacementOnOutsideClick(isEditMode);

	// 편집은 서버에 저장된 배치에서 시작한다.
	const handleEnterEditMode = () => {
		setSaveError(null);
		setPlacements(userId, savedPlacements ?? []);
		enterEditMode();
	};

	const handleSave = async () => {
		setSaveError(null);
		try {
			const result = await saveCollection({
				userId,
				placements: editorPlacements ?? [],
				saved: savedPlacements ?? [],
			});
			exitEditMode();
			if (result.skipped > 0) {
				window.alert(
					`${result.skipped}개 배치는 저장하지 못했습니다.\n` +
						"샘플 도안이거나, 같은 도안을 이미 다른 위치에 배치한 경우입니다.",
				);
			}
		} catch (err) {
			setSaveError(
				err instanceof ApiError
					? err.message
					: "컬렉션을 저장하지 못했습니다.",
			);
		}
	};

	return (
		<div>
			{isEditMode ? (
				<>
					<div className="mx-auto max-w-[420px] px-4 lg:px-0">
						<MannequinCanvas userId={userId} />
						{saveError && (
							<p className="mt-4 text-center text-[13px] text-red-600">
								{saveError}
							</p>
						)}
						<div className="mt-6 hidden justify-center lg:flex">
							<CtaButton
								onClick={() => void handleSave()}
								disabled={isSaving}
								className={collectionCtaClassName}>
								{isSaving ? <LoadingLabel>저장 중…</LoadingLabel> : "저장하기"}
							</CtaButton>
						</div>
					</div>

					<CollectionArchivePanel
						designs={designs}
						isLoading={isArchiveLoading}
						variant="floating"
						userId={userId}
					/>
					<div className="mt-5 flex justify-center lg:hidden">
						<CtaButton
							onClick={() => void handleSave()}
							disabled={isSaving}
							className={collectionCtaClassName}>
							{isSaving ? <LoadingLabel>저장 중…</LoadingLabel> : "저장하기"}
						</CtaButton>
					</div>
				</>
			) : (
				<>
					{isLoadingSaved ? (
						<StarttooLoader variant="block" label="컬렉션을 불러오는 중…" />
					) : (
						<CollectionPreview placements={savedPlacements ?? []} />
					)}
					{isSavedError && (
						<p className="mt-4 text-center text-[13px] text-black/60">
							컬렉션을 불러오지 못했습니다.
						</p>
					)}
					<div className="mt-6 flex justify-center">
						<CtaButton
							onClick={handleEnterEditMode}
							disabled={isLoadingSaved}
							className={`${collectionCtaClassName} border border-black/20 !bg-white !text-black hover:!brightness-100 hover:bg-black/5`}>
							편집하기
						</CtaButton>
					</div>
				</>
			)}
		</div>
	);
}
