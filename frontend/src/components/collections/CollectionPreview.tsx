import useCollectionStore from "../../store/useCollectionStore";
import { isMannequinSkin } from "../../types/collection";
import type { CollectionPlacement, MannequinSkin } from "../../types/collection";
import MannequinPreviewPane from "./MannequinPreviewPane";

type CollectionPreviewProps = {
	placements: CollectionPlacement[];
	/** 없으면 내 저장값을 쓴다 (다른 사람 컬렉션은 톤이 응답에 없어 기본 톤) */
	skin?: MannequinSkin;
};

/** 저장된 컬렉션 미리보기 — 앞·뒤 동시 표시 */
export default function CollectionPreview({
	placements,
	skin,
}: CollectionPreviewProps) {
	const savedSkin = useCollectionStore((s) => s.savedSkin);
	const resolved = skin ?? savedSkin;
	const safeSkin = isMannequinSkin(resolved) ? resolved : "white";

	return (
		<div className="mx-4 flex flex-row items-stretch justify-center gap-2 rounded-[10px] bg-white p-4 lg:mx-0 lg:gap-6 lg:bg-transparent lg:p-0">
			<MannequinPreviewPane
				placements={placements}
				view="front"
				skin={safeSkin}
				label="앞"
			/>
			<MannequinPreviewPane
				placements={placements}
				view="back"
				skin={safeSkin}
				label="뒤"
			/>
		</div>
	);
}
