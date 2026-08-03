import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { MANNEQUIN_ASSETS } from "../../constants/mannequinAssets";
import type {
	CollectionPlacement,
	MannequinSkin,
	MannequinView,
} from "../../types/collection";
import MannequinWarpedTattoos from "./MannequinWarpedTattoos";

type MannequinPreviewPaneProps = {
	/** 양쪽 뷰의 배치 전체 — 이 컴포넌트가 view로 걸러 쓴다 */
	placements: CollectionPlacement[];
	view: MannequinView;
	skin: MannequinSkin;
	label: string;
};

/** 미리보기용 단일 마네킹 (읽기 전용) */
export default function MannequinPreviewPane({
	placements: allPlacements,
	view,
	skin,
	label,
}: MannequinPreviewPaneProps) {
	const canvasRef = useRef<HTMLDivElement>(null);
	const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

	const placements = useMemo(
		() => allPlacements.filter((p) => p.view === view),
		[allPlacements, view],
	);

	const mannequinSrc = MANNEQUIN_ASSETS[skin][view];

	useLayoutEffect(() => {
		const node = canvasRef.current;
		if (!node) return;

		const observer = new ResizeObserver(([entry]) => {
			const { width, height } = entry.contentRect;
			setCanvasSize((prev) =>
				prev.width === width && prev.height === height
					? prev
					: { width, height },
			);
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	return (
		<div className="flex min-w-0 flex-1 flex-col items-center">
			<p className="mb-3 text-[13px] font-medium text-black/55">{label}</p>
			<div
				ref={canvasRef}
				className="relative aspect-[3/5] w-full max-w-[280px] overflow-visible bg-transparent">
				<img
					src={mannequinSrc}
					alt=""
					className="pointer-events-none absolute inset-0 size-full object-contain"
					draggable={false}
				/>
				{canvasSize.width > 0 && (
					<MannequinWarpedTattoos
						mannequinSrc={mannequinSrc}
						view={view}
						placements={placements}
						canvasWidth={canvasSize.width}
						canvasHeight={canvasSize.height}
					/>
				)}
			</div>
		</div>
	);
}
