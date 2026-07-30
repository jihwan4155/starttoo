import useCollectionStore from "../../store/useCollectionStore";
import { isMannequinSkin } from "../../types/collection";
import MannequinPreviewPane from "./MannequinPreviewPane";

type CollectionPreviewProps = {
	userId: number;
};

/** 저장된 컬렉션 미리보기 — 앞·뒤 동시 표시 (피부 톤은 저장값 유지) */
export default function CollectionPreview({ userId }: CollectionPreviewProps) {
	const savedSkin = useCollectionStore((s) => s.savedSkin);
	const safeSkin = isMannequinSkin(savedSkin) ? savedSkin : "white";

	return (
		<div className="flex flex-col items-stretch gap-8 sm:flex-row sm:justify-center sm:gap-6">
			<MannequinPreviewPane
				userId={userId}
				view="front"
				skin={safeSkin}
				label="앞"
			/>
			<MannequinPreviewPane
				userId={userId}
				view="back"
				skin={safeSkin}
				label="뒤"
			/>
		</div>
	);
}
