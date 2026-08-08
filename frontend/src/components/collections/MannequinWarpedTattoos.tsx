import { useEffect, useMemo, useRef } from "react";

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
	/** 도안 이미지·워프 합성 진행 여부 — 섹션 로더용 */
	onRenderingChange?: (busy: boolean) => void;
};

type LayerCacheEntry = {
	key: string;
	canvas: HTMLCanvasElement;
};

function placementRenderKey(
	placement: CollectionPlacement,
	quality: MannequinRenderQuality,
	renderWidth: number,
	renderHeight: number,
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
		renderWidth,
		renderHeight,
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
	onRenderingChange,
}: MannequinWarpedTattoosProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const renderTokenRef = useRef(0);
	const layerCacheRef = useRef(new Map<string, LayerCacheEntry>());
	const onRenderingChangeRef = useRef(onRenderingChange);
	onRenderingChangeRef.current = onRenderingChange;
	const quality: MannequinRenderQuality = interactive ? "draft" : "final";
	const renderScale = getMannequinRenderScale(quality);
	const renderWidth = Math.round(canvasWidth * renderScale);
	const renderHeight = Math.round(canvasHeight * renderScale);

	// placements 참조 변경만으로 effect가 재실행되지 않게 내용 키로 고정
	const placementsKey = useMemo(
		() =>
			placements
				.map((p) => placementRenderKey(p, quality, renderWidth, renderHeight))
				.join(";"),
		[placements, quality, renderWidth, renderHeight],
	);

	useEffect(() => {
		if (canvasWidth <= 0 || canvasHeight <= 0) return;

		let cancelled = false;
		let rafId = 0;
		const token = ++renderTokenRef.current;

		const setBusy = (busy: boolean) => {
			onRenderingChangeRef.current?.(busy);
		};

		const hasUncached = placements.some((placement) => {
			const key = placementRenderKey(
				placement,
				quality,
				renderWidth,
				renderHeight,
			);
			return layerCacheRef.current.get(placement.id)?.key !== key;
		});
		// 리사이즈 재합성은 백그라운드로만 — 섹션 로더는 최초/도안 변경에만
		const isResizeOnly =
			hasUncached &&
			placements.every((placement) => layerCacheRef.current.has(placement.id));
		const shouldReportBusy =
			placements.length > 0 &&
			hasUncached &&
			!isResizeOnly &&
			(!interactive ||
				placements.some((p) => !layerCacheRef.current.has(p.id)));

		// rAF/await 전에 동기적으로 알려 빈 마네킹 한 프레임을 막는다.
		if (placements.length === 0) setBusy(false);
		else if (shouldReportBusy) setBusy(true);

		const run = () => {
			void (async () => {
				let finished = false;
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
						finished = true;
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
						const key = placementRenderKey(
							placement,
							quality,
							renderWidth,
							renderHeight,
						);
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
					finished = true;
				} catch {
					if (cancelled || token !== renderTokenRef.current) return;
					const canvas = canvasRef.current;
					const context = canvas?.getContext("2d");
					context?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
					finished = true;
				} finally {
					if (
						finished &&
						!cancelled &&
						token === renderTokenRef.current
					) {
						setBusy(false);
					}
				}
			})();
		};

		rafId = requestAnimationFrame(run);

		return () => {
			cancelled = true;
			cancelAnimationFrame(rafId);
		};
		// placementsKey로 내용·해상도 변경을 추적 (placements 참조는 제외)
		// eslint-disable-next-line react-hooks/exhaustive-deps -- placementsKey가 placements 내용을 대표
	}, [
		mannequinSrc,
		view,
		placementsKey,
		canvasWidth,
		canvasHeight,
		quality,
		interactive,
		renderWidth,
		renderHeight,
	]);

	return (
		<canvas
			ref={canvasRef}
			className="pointer-events-none absolute inset-0 size-full mix-blend-multiply"
			aria-hidden
		/>
	);
}
