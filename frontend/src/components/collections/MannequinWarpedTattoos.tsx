import { useEffect, useRef } from "react";

import type { CollectionPlacement, MannequinView } from "../../types/collection";
import {
	getMannequinRenderScale,
	renderMannequinTattooLayer,
	type MannequinRenderQuality,
} from "../../utils/mannequinLimbWarp";
import {
	getMannequinSurface,
	loadTattooCanvas,
} from "../../utils/mannequinSurface";

type MannequinWarpedTattoosProps = {
	mannequinSrc: string;
	view: MannequinView;
	placements: CollectionPlacement[];
	canvasWidth: number;
	canvasHeight: number;
	/** 편집 중 드래그 — 낮은 해상도·캐시 활용 */
	interactive?: boolean;
};

type LayerCacheEntry = {
	key: string;
	canvas: HTMLCanvasElement;
};

function placementRenderKey(
	placement: CollectionPlacement,
	quality: MannequinRenderQuality,
) {
	return [
		placement.id,
		placement.imageUrl,
		placement.flipX ?? false,
		placement.x.toFixed(4),
		placement.y.toFixed(4),
		placement.scale.toFixed(4),
		placement.rotation,
		quality,
	].join("|");
}

/** 마네킹 위 도안 — 부위 마스크 워프 + 고해상도 합성 */
export default function MannequinWarpedTattoos({
	mannequinSrc,
	view,
	placements,
	canvasWidth,
	canvasHeight,
	interactive = false,
}: MannequinWarpedTattoosProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const renderTokenRef = useRef(0);
	const layerCacheRef = useRef(new Map<string, LayerCacheEntry>());
	const quality: MannequinRenderQuality = interactive ? "draft" : "final";

	useEffect(() => {
		if (canvasWidth <= 0 || canvasHeight <= 0) return;

		let cancelled = false;
		let rafId = 0;
		const token = ++renderTokenRef.current;
		const renderScale = getMannequinRenderScale(quality);
		const renderWidth = Math.round(canvasWidth * renderScale);
		const renderHeight = Math.round(canvasHeight * renderScale);

		const run = () => {
			void (async () => {
				try {
					const surface = await getMannequinSurface(
						mannequinSrc,
						view,
						renderWidth,
						renderHeight,
					);
					if (cancelled || token !== renderTokenRef.current) return;

					const canvas = canvasRef.current;
					if (!canvas) return;

					canvas.width = renderWidth;
					canvas.height = renderHeight;
					const context = canvas.getContext("2d");
					if (!context) return;

					context.clearRect(0, 0, renderWidth, renderHeight);
					if (placements.length === 0) {
						layerCacheRef.current.clear();
						return;
					}

					const layer = document.createElement("canvas");
					layer.width = renderWidth;
					layer.height = renderHeight;
					const layerContext = layer.getContext("2d");
					const activeIds = new Set(placements.map((p) => p.id));

					for (const id of layerCacheRef.current.keys()) {
						if (!activeIds.has(id)) layerCacheRef.current.delete(id);
					}

					for (const placement of placements) {
						const key = placementRenderKey(placement, quality);
						const cached = layerCacheRef.current.get(placement.id);
						if (cached?.key === key) {
							context.drawImage(cached.canvas, 0, 0);
							continue;
						}

						const tattoo = await loadTattooCanvas(
							placement.imageUrl,
							placement.flipX ?? false,
						);
						if (cancelled || token !== renderTokenRef.current) return;

						renderMannequinTattooLayer(
							layer,
							tattoo,
							surface.personMask,
							surface.partMask,
							{
								x: placement.x,
								y: placement.y,
								scale: placement.scale,
								rotation: placement.rotation,
								bodyPart: placement.bodyPart,
							},
							quality,
						);

						let entry = cached;
						if (!entry) {
							const cacheCanvas = document.createElement("canvas");
							entry = { key, canvas: cacheCanvas };
							layerCacheRef.current.set(placement.id, entry);
						} else {
							entry.key = key;
						}

						entry.canvas.width = renderWidth;
						entry.canvas.height = renderHeight;
						entry.canvas.getContext("2d")?.drawImage(layer, 0, 0);
						context.drawImage(entry.canvas, 0, 0);
						layerContext?.clearRect(0, 0, renderWidth, renderHeight);
					}
				} catch {
					if (cancelled || token !== renderTokenRef.current) return;
					const canvas = canvasRef.current;
					const context = canvas?.getContext("2d");
					context?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
				}
			})();
		};

		rafId = requestAnimationFrame(run);

		return () => {
			cancelled = true;
			cancelAnimationFrame(rafId);
		};
	}, [mannequinSrc, view, placements, canvasWidth, canvasHeight, quality]);

	return (
		<canvas
			ref={canvasRef}
			className="pointer-events-none absolute inset-0 size-full mix-blend-multiply"
			aria-hidden
		/>
	);
}
