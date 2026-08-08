import { useEffect, useMemo, useState } from "react";
import useCollectionStore from "../../store/useCollectionStore";
import { isMannequinSkin } from "../../types/collection";
import type { CollectionPlacement, MannequinSkin } from "../../types/collection";
import StarttooLoader from "../loader/StarttooLoader";
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
	const hasPlacements = placements.length > 0;
	const placementKey = useMemo(
		() => placements.map((p) => `${p.id}:${p.imageUrl}`).join("|"),
		[placements],
	);

	const [frontBusy, setFrontBusy] = useState(hasPlacements);
	const [backBusy, setBackBusy] = useState(hasPlacements);
	// busy가 리사이즈·재합성으로 다시 true가 되어도, 한 번 공개한 뒤에는 로더로 돌아가지 않는다.
	const [ready, setReady] = useState(!hasPlacements);
	const showLoader = hasPlacements && !ready;

	useEffect(() => {
		if (!hasPlacements) {
			setFrontBusy(false);
			setBackBusy(false);
			setReady(true);
			return;
		}
		setReady(false);
		setFrontBusy(true);
		setBackBusy(true);
	}, [hasPlacements, placementKey]);

	useEffect(() => {
		if (!hasPlacements || ready || frontBusy || backBusy) return;

		// 캔버스 paint 이후에 공개해 빈 프레임이 비치지 않게 한다.
		let raf2 = 0;
		const raf1 = requestAnimationFrame(() => {
			raf2 = requestAnimationFrame(() => setReady(true));
		});
		return () => {
			cancelAnimationFrame(raf1);
			cancelAnimationFrame(raf2);
		};
	}, [hasPlacements, ready, frontBusy, backBusy]);

	return (
		<div className="relative mx-4 min-h-[280px] lg:mx-0">
			<div
				aria-hidden={showLoader}
				className={`flex flex-row items-stretch justify-center gap-2 rounded-[10px] bg-white p-4 lg:gap-6 lg:bg-transparent lg:p-0 ${
					showLoader ? "invisible" : ""
				}`}>
				<MannequinPreviewPane
					placements={placements}
					view="front"
					skin={safeSkin}
					label="앞"
					onRenderingChange={setFrontBusy}
				/>
				<MannequinPreviewPane
					placements={placements}
					view="back"
					skin={safeSkin}
					label="뒤"
					onRenderingChange={setBackBusy}
				/>
			</div>
			{showLoader && (
				<div className="absolute inset-0 z-10 flex items-center justify-center rounded-[10px] bg-white">
					<StarttooLoader
						variant="block"
						size={200}
						label="도안을 불러오는 중…"
						delayMs={0}
					/>
				</div>
			)}
		</div>
	);
}
