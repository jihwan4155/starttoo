import { memo, useCallback, useRef } from "react";
import type { CollectionPlacement } from "../../types/collection";
import useCollectionStore from "../../store/useCollectionStore";

type PlacementPatch = Partial<
	Pick<CollectionPlacement, "x" | "y" | "scale" | "rotation" | "flipX">
>;

type PlacedTattooProps = {
	placement: CollectionPlacement;
	canvasWidth: number;
	canvasHeight: number;
	userId: number;
	isEditMode: boolean;
	onDraftChange?: (id: string, patch: PlacementPatch) => void;
	onDraftCommit?: (id: string, patch: PlacementPatch) => void;
};

type DragMode = "move" | "scale" | "rotate";

type DragSession = {
	mode: DragMode;
	pointerId: number;
	startX: number;
	startY: number;
	originX: number;
	originY: number;
	originScale: number;
	originRotation: number;
	/**
	 * 도안 중심의 화면(clientX/Y) 좌표.
	 *
	 * <p>크기·회전은 중심에서 포인터까지의 거리·각도로 잰다. 캔버스 안 비율 좌표에
	 * 캔버스 폭만 곱한 값은 화면 좌표가 아니라(캔버스가 페이지 어디에 있는지가 빠져
	 * 있다) 거리가 엉뚱하게 나온다. 캔버스가 포인터보다 오른쪽·아래에 놓이는 배치에서는
	 * 바깥으로 끌수록 중심에서 멀어지는 대신 가까워져, 확대가 축소로 뒤집힌다.
	 */
	centerX: number;
	centerY: number;
	/** 회전 시작 시점의 중심 기준 포인터 각도(도) */
	startAngle: number;
};

const MIN_SCALE = 0.06;
const MAX_SCALE = 0.55;
const CLICK_THRESHOLD_PX = 5;
const SCALE_SENSITIVITY = 1.75;

/** 마네킹 위 도안 — 클릭 선택 + 드래그 이동·크기·회전·반전·삭제 */
function PlacedTattoo({
	placement,
	canvasWidth,
	canvasHeight,
	userId,
	isEditMode,
	onDraftChange,
	onDraftCommit,
}: PlacedTattooProps) {
	const selectedPlacementId = useCollectionStore((s) => s.selectedPlacementId);
	const setSelectedPlacementId = useCollectionStore(
		(s) => s.setSelectedPlacementId,
	);
	const updatePlacement = useCollectionStore((s) => s.updatePlacement);
	const removePlacement = useCollectionStore((s) => s.removePlacement);

	// 도안 중심의 화면 좌표를 재려면 실제로 그려진 상자가 필요하다
	const rootRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<DragSession | null>(null);
	const didDragRef = useRef(false);
	const draftPatchRef = useRef<PlacementPatch>({});

	const isSelected = isEditMode && selectedPlacementId === placement.id;
	const widthPx = canvasWidth * placement.scale;
	const flipX = placement.flipX ?? false;

	const applyDraft = (patch: PlacementPatch) => {
		draftPatchRef.current = { ...draftPatchRef.current, ...patch };
		onDraftChange?.(placement.id, draftPatchRef.current);
	};

	const commitDraft = () => {
		const patch = draftPatchRef.current;
		draftPatchRef.current = {};
		if (Object.keys(patch).length === 0) return;
		if (onDraftCommit) {
			onDraftCommit(placement.id, patch);
			return;
		}
		updatePlacement(userId, placement.id, patch);
	};

	const startDrag = (
		event: React.PointerEvent<HTMLElement>,
		mode: DragMode,
	) => {
		if (!isEditMode) return;
		event.stopPropagation();

		draftPatchRef.current = {};
		// 상자는 중심을 기준으로 translate(-50%,-50%)돼 있어 rect 중앙이 곧 도안 중심이다
		// (회전해도 중심은 그대로다).
		const rect = rootRef.current?.getBoundingClientRect();
		const centerX = rect ? rect.left + rect.width / 2 : event.clientX;
		const centerY = rect ? rect.top + rect.height / 2 : event.clientY;
		dragRef.current = {
			mode,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originX: placement.x,
			originY: placement.y,
			originScale: placement.scale,
			originRotation: placement.rotation,
			centerX,
			centerY,
			startAngle: angleDeg(centerX, centerY, event.clientX, event.clientY),
		};
		didDragRef.current = false;
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;

		const movedPx = Math.hypot(
			event.clientX - drag.startX,
			event.clientY - drag.startY,
		);
		if (movedPx < CLICK_THRESHOLD_PX && drag.mode === "move") return;

		if (drag.mode === "move" && !didDragRef.current) {
			didDragRef.current = true;
			setSelectedPlacementId(placement.id);
		}

		if (drag.mode !== "move" || didDragRef.current) {
			didDragRef.current = true;
		}

		if (drag.mode === "move") {
			const dx = (event.clientX - drag.startX) / canvasWidth;
			const dy = (event.clientY - drag.startY) / canvasHeight;
			applyDraft({
				x: clamp01(drag.originX + dx),
				y: clamp01(drag.originY + dy),
			});
			return;
		}

		if (drag.mode === "scale") {
			const startDist = Math.hypot(
				drag.startX - drag.centerX,
				drag.startY - drag.centerY,
			);
			const currentDist = Math.hypot(
				event.clientX - drag.centerX,
				event.clientY - drag.centerY,
			);
			if (startDist < 1) return;
			const rawRatio = currentDist / startDist;
			const amplified = 1 + (rawRatio - 1) * SCALE_SENSITIVITY;
			applyDraft({
				scale: clampScale(drag.originScale * amplified),
			});
			return;
		}

		// 회전은 포인터를 따라간다 — 중심에서 본 포인터 각도가 움직인 만큼 돌린다.
		const angleDelta =
			angleDeg(drag.centerX, drag.centerY, event.clientX, event.clientY) -
			drag.startAngle;
		applyDraft({
			rotation: normalizeAngle(drag.originRotation + angleDelta),
		});
	};

	const endDrag = (event: React.PointerEvent<HTMLElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;

		if (drag.mode === "move" && !didDragRef.current) {
			setSelectedPlacementId(placement.id);
		}

		if (didDragRef.current) {
			commitDraft();
		}

		dragRef.current = null;
		didDragRef.current = false;
		event.currentTarget.releasePointerCapture(event.pointerId);
	};

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			if (!isSelected) return;
			const step = event.shiftKey ? 0.02 : 0.008;
			if (event.key === "ArrowLeft") {
				event.preventDefault();
				updatePlacement(userId, placement.id, {
					x: clamp01(placement.x - step),
				});
			} else if (event.key === "ArrowRight") {
				event.preventDefault();
				updatePlacement(userId, placement.id, {
					x: clamp01(placement.x + step),
				});
			} else if (event.key === "ArrowUp") {
				event.preventDefault();
				updatePlacement(userId, placement.id, {
					y: clamp01(placement.y - step),
				});
			} else if (event.key === "ArrowDown") {
				event.preventDefault();
				updatePlacement(userId, placement.id, {
					y: clamp01(placement.y + step),
				});
			} else if (event.key === "Delete" || event.key === "Backspace") {
				event.preventDefault();
				removePlacement(userId, placement.id);
			}
		},
		[
			isSelected,
			placement.id,
			placement.x,
			placement.y,
			removePlacement,
			updatePlacement,
			userId,
		],
	);

	const handleFlip = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		updatePlacement(userId, placement.id, { flipX: !flipX });
	};

	const handleDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		removePlacement(userId, placement.id);
	};

	return (
		<div
			ref={rootRef}
			className={`absolute touch-none select-none ${isSelected ? "z-20" : "z-10"}`}
			style={{
				left: `${placement.x * 100}%`,
				top: `${placement.y * 100}%`,
				width: widthPx,
				height: widthPx * 1.2,
				transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
				pointerEvents: "none",
			}}>
			<div
				role={isEditMode ? "button" : undefined}
				tabIndex={isEditMode ? 0 : undefined}
				data-tattoo-interactive={isEditMode ? true : undefined}
				onPointerDown={
					isEditMode ? (event) => startDrag(event, "move") : undefined
				}
				onPointerMove={isEditMode ? handlePointerMove : undefined}
				onPointerUp={isEditMode ? endDrag : undefined}
				onPointerCancel={isEditMode ? endDrag : undefined}
				onKeyDown={isEditMode ? handleKeyDown : undefined}
				className="relative size-full"
				style={{
					pointerEvents: isEditMode ? "auto" : "none",
					cursor: isEditMode ? (isSelected ? "grab" : "pointer") : "default",
				}}>
				{isEditMode && !isSelected && (
					<div
						className="pointer-events-none absolute inset-0 border border-dashed border-black/20"
						aria-hidden
					/>
				)}

				{isSelected && (
					<>
						<div
							className="pointer-events-none absolute inset-0 border-2 border-black/75"
							aria-hidden
						/>

						<button
							type="button"
							title="삭제"
							aria-label="도안 삭제"
							data-tattoo-interactive
							onClick={handleDelete}
							onPointerDown={(event) => event.stopPropagation()}
							className="absolute -right-2 -top-2 z-30 flex size-6 items-center justify-center rounded-full bg-black text-[11px] font-bold text-white shadow-md transition hover:bg-black/85">
							×
						</button>

						<button
							type="button"
							title="좌우 반전"
							aria-label="좌우 반전"
							data-tattoo-interactive
							onClick={handleFlip}
							onPointerDown={(event) => event.stopPropagation()}
							className="absolute -bottom-2 -left-2 z-30 flex size-6 items-center justify-center rounded-full border border-black/20 bg-white text-[10px] font-semibold text-black/70 shadow-sm transition hover:bg-black/5">
							⇄
						</button>

						<div
							role="presentation"
							title="크기 조절"
							data-tattoo-interactive
							onPointerDown={(event) => {
								setSelectedPlacementId(placement.id);
								startDrag(event, "scale");
							}}
							onPointerMove={handlePointerMove}
							onPointerUp={endDrag}
							onPointerCancel={endDrag}
							className="absolute -bottom-2 -right-2 z-30 size-4 cursor-se-resize rounded-sm border-2 border-black bg-white shadow-sm"
						/>

						<div
							role="presentation"
							title="회전"
							data-tattoo-interactive
							onPointerDown={(event) => {
								setSelectedPlacementId(placement.id);
								startDrag(event, "rotate");
							}}
							onPointerMove={handlePointerMove}
							onPointerUp={endDrag}
							onPointerCancel={endDrag}
							className="absolute -top-7 left-1/2 z-30 size-4 -translate-x-1/2 cursor-grab rounded-full border-2 border-black bg-white shadow-sm"
						/>
					</>
				)}
			</div>
		</div>
	);
}

export default memo(PlacedTattoo, (prev, next) => {
	return (
		prev.canvasWidth === next.canvasWidth &&
		prev.canvasHeight === next.canvasHeight &&
		prev.userId === next.userId &&
		prev.isEditMode === next.isEditMode &&
		prev.onDraftChange === next.onDraftChange &&
		prev.onDraftCommit === next.onDraftCommit &&
		prev.placement.id === next.placement.id &&
		prev.placement.x === next.placement.x &&
		prev.placement.y === next.placement.y &&
		prev.placement.scale === next.placement.scale &&
		prev.placement.rotation === next.placement.rotation &&
		prev.placement.flipX === next.placement.flipX &&
		prev.placement.imageUrl === next.placement.imageUrl
	);
});

function clamp01(value: number) {
	return Math.min(1, Math.max(0, value));
}

function clampScale(value: number) {
	return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

/** 중심에서 본 포인터 각도(도). CSS rotate와 같은 방향(시계) 기준이다. */
function angleDeg(
	centerX: number,
	centerY: number,
	pointX: number,
	pointY: number,
) {
	return (Math.atan2(pointY - centerY, pointX - centerX) * 180) / Math.PI;
}

function normalizeAngle(value: number) {
	let angle = value % 360;
	if (angle > 180) angle -= 360;
	if (angle <= -180) angle += 360;
	return Math.round(angle);
}
