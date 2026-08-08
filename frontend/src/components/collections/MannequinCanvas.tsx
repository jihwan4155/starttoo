import { useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { ARCHIVE_DRAG_MIME } from "../../constants/collectionDrag";
import ActionConfirmModal from "../common/ActionConfirmModal";
import {
	MANNEQUIN_ASSETS,
	MANNEQUIN_SKIN_OPTIONS,
} from "../../constants/mannequinAssets";
import useCollectionStore from "../../store/useCollectionStore";
import inferBodyPart from "../../utils/inferBodyPart";
import type { ArchiveDragPayload, CollectionPlacement, MannequinView } from "../../types/collection";
import { isMannequinSkin, isMannequinView } from "../../types/collection";
import PlacedTattoo from "./PlacedTattoo";
import MannequinWarpedTattoos from "./MannequinWarpedTattoos";

type DraftPatch = Partial<
	Pick<CollectionPlacement, "x" | "y" | "scale" | "rotation" | "flipX">
>;

type LiveDraft = {
	id: string;
	patch: DraftPatch;
};

type MannequinCanvasProps = {
	userId: number;
};

/** 편집 모드 마네킹 캔버스 — 앞/뒤 탭 전환 */
export default function MannequinCanvas({ userId }: MannequinCanvasProps) {
	const canvasRef = useRef<HTMLDivElement>(null);
	const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
	const draftRef = useRef<LiveDraft | null>(null);
	const draftRafRef = useRef<number | null>(null);
	const [renderDraft, setRenderDraft] = useState<LiveDraft | null>(null);
	const [isClearConfirmOpen, setClearConfirmOpen] = useState(false);

	const {
		editorSkin,
		editorView,
		byUser,
		setEditorSkin,
		setEditorView,
		addPlacement,
		clearViewPlacements,
		updatePlacement,
	} = useCollectionStore(
		useShallow((s) => ({
			editorSkin: s.editorSkin,
			editorView: s.editorView,
			byUser: s.byUser ?? {},
			setEditorSkin: s.setEditorSkin,
			setEditorView: s.setEditorView,
			addPlacement: s.addPlacement,
			clearViewPlacements: s.clearViewPlacements,
			updatePlacement: s.updatePlacement,
		})),
	);

	const safeSkin = isMannequinSkin(editorSkin) ? editorSkin : "white";
	const safeView = isMannequinView(editorView) ? editorView : "front";

	const placements = useMemo(
		() =>
			(byUser[String(userId)] ?? []).filter((p) => p.view === safeView),
		[byUser, userId, safeView],
	);

	const renderPlacements = useMemo(() => {
		if (!renderDraft) return placements;
		return placements.map((placement) =>
			placement.id === renderDraft.id
				? { ...placement, ...renderDraft.patch }
				: placement,
		);
	}, [placements, renderDraft]);

	const handleDraftChange = useCallback((id: string, patch: DraftPatch) => {
		draftRef.current = { id, patch };
		if (draftRafRef.current !== null) return;
		draftRafRef.current = requestAnimationFrame(() => {
			draftRafRef.current = null;
			setRenderDraft(draftRef.current);
		});
	}, []);

	const handleDraftCommit = useCallback(
		(id: string, patch: DraftPatch) => {
			if (draftRafRef.current !== null) {
				cancelAnimationFrame(draftRafRef.current);
				draftRafRef.current = null;
			}
			draftRef.current = null;
			setRenderDraft(null);
			updatePlacement(userId, id, patch);
		},
		[updatePlacement, userId],
	);

	const mannequinSrc = MANNEQUIN_ASSETS[safeSkin][safeView];

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

	const readDropPayload = (
		event: React.DragEvent<HTMLDivElement>,
	): ArchiveDragPayload | null => {
		const raw = event.dataTransfer.getData(ARCHIVE_DRAG_MIME);
		if (!raw) return null;
		try {
			return JSON.parse(raw) as ArchiveDragPayload;
		} catch {
			return null;
		}
	};

	const positionFromEvent = (event: React.DragEvent<HTMLDivElement>) => {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect?.width || !rect.height) return null;
		return {
			x: clamp01((event.clientX - rect.left) / rect.width),
			y: clamp01((event.clientY - rect.top) / rect.height),
		};
	};

	const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
		if (event.dataTransfer.types.includes(ARCHIVE_DRAG_MIME)) {
			event.preventDefault();
			event.dataTransfer.dropEffect = "copy";
		}
	};

	const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		const payload = readDropPayload(event);
		const position = positionFromEvent(event);
		if (!payload || !position) return;

		addPlacement(userId, {
			tattooId: payload.tattooId,
			imageSeq: payload.imageSeq,
			imageUrl: payload.imageUrl,
			bodyPart: inferBodyPart(position.y),
			view: safeView,
			x: position.x,
			y: position.y,
			scale: 0.18,
			rotation: 0,
			flipX: false,
		});
	};

	const handleConfirmClearView = () => {
		clearViewPlacements(userId, safeView);
		setClearConfirmOpen(false);
	};

	return (
		<div className="flex min-w-0 flex-col">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-4">
					<div className="flex items-center gap-2">
						<span className="text-[13px] text-black/50">피부 톤</span>
						<div className="flex gap-2">
							{MANNEQUIN_SKIN_OPTIONS.map((option) => (
								<button
									key={option.id}
									type="button"
									title={option.label}
									aria-label={option.label}
									aria-pressed={safeSkin === option.id}
									onClick={() => setEditorSkin(option.id)}
									className={`size-8 rounded-full transition ${option.swatchClass} ${
										safeSkin === option.id
											? "ring-2 ring-black ring-offset-2"
											: "opacity-70 hover:opacity-100"
									}`}
								/>
							))}
						</div>
					</div>

					<div className="flex items-center gap-2">
						<span className="text-[13px] text-black/50">편집 중</span>
						<ViewToggle view={safeView} onChange={setEditorView} />
					</div>
				</div>

				<button
					type="button"
					onClick={() => setClearConfirmOpen(true)}
					disabled={placements.length === 0}
					className="text-[13px] text-black/45 underline-offset-2 hover:text-black/70 hover:underline disabled:cursor-not-allowed disabled:opacity-30">
					현재 보기 초기화
				</button>
			</div>

			<div
				ref={canvasRef}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
				className="relative mx-auto aspect-[3/5] w-full max-w-[360px] overflow-visible rounded-[12px] bg-transparent">
				<img
					src={mannequinSrc}
					alt=""
					className="pointer-events-none absolute inset-0 size-full object-contain"
					draggable={false}
				/>

				{canvasSize.width > 0 && (
					<MannequinWarpedTattoos
						mannequinSrc={mannequinSrc}
						view={safeView}
						placements={renderPlacements}
						canvasWidth={canvasSize.width}
						canvasHeight={canvasSize.height}
						interactive
					/>
				)}

				{canvasSize.width > 0 &&
					renderPlacements.map((placement) => (
						<PlacedTattoo
							key={placement.id}
							placement={placement}
							canvasWidth={canvasSize.width}
							canvasHeight={canvasSize.height}
							userId={userId}
							isEditMode
							onDraftChange={handleDraftChange}
							onDraftCommit={handleDraftCommit}
						/>
					))}
			</div>

			<p className="mt-3 text-center text-[12px] text-black/40">
				{placements.length === 0
					? "오른쪽 도안 보관함에서 끌어다 놓으세요"
					: `${placements.length}개 배치됨 · 도안 클릭 후 박스 핸들로 조절`}
			</p>

			<ActionConfirmModal
				isOpen={isClearConfirmOpen}
				title="현재 보기의 배치를 모두 지울까요?"
				description={`${safeView === "front" ? "앞" : "뒤"}면에 놓은 도안 ${placements.length}개가 지워집니다. 반대쪽 배치는 그대로 남습니다.`}
				confirmText="모두 지우기"
				onClose={() => setClearConfirmOpen(false)}
				onConfirm={handleConfirmClearView}
			/>
		</div>
	);
}

function ViewToggle({
	view,
	onChange,
}: {
	view: MannequinView;
	onChange: (view: MannequinView) => void;
}) {
	return (
		<div className="flex overflow-hidden rounded-[6px] border border-black/15">
			{(["front", "back"] as const).map((option) => (
				<button
					key={option}
					type="button"
					onClick={() => onChange(option)}
					aria-pressed={view === option}
					className={`px-3 py-1.5 text-[13px] transition ${
						view === option
							? "bg-black font-medium text-white"
							: "bg-white text-black/55 hover:bg-black/5"
					}`}>
					{option === "front" ? "앞" : "뒤"}
				</button>
			))}
		</div>
	);
}

function clamp01(value: number) {
	return Math.min(1, Math.max(0, value));
}
