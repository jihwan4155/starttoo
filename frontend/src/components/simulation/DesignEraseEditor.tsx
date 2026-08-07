import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
} from "react";
import { loadImage } from "./useBodyScan";

type DesignEraseEditorProps = {
	/** 보관함에서 고른 원본 — 원상복귀 기준 */
	originalUrl: string;
	/** 지우개로 편집된 결과를 blob URL로 넘긴다 */
	onChange: (url: string) => void;
};

const BRUSH_MIN = 8;
const BRUSH_MAX = 72;
const BRUSH_DEFAULT = 28;

function EraserIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden>
			<path d="M20 20H8.5L3 14.5a1.5 1.5 0 0 1 0-2.12l7.9-7.9a1.5 1.5 0 0 1 2.12 0l6.5 6.5a1.5 1.5 0 0 1 0 2.12L12 20" />
			<path d="M6 17.5 13.5 10" />
		</svg>
	);
}

function RestoreIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden>
			<path d="M3 7v6h6" />
			<path d="M3.5 13a9 9 0 1 0 2.6-6.4L3 9.5" />
		</svg>
	);
}

/**
 * 도안 프리뷰 위 지우개.
 *
 * destination-out으로 불필요한 부분을 지우고, 원상복귀는 원본을 다시 그린다.
 * 획이 끝날 때마다 PNG blob URL을 부모에 넘겨 STEP3 합성에 쓰이게 한다.
 */
export default function DesignEraseEditor({
	originalUrl,
	onChange,
}: DesignEraseEditorProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const drawingRef = useRef(false);
	const lastPointRef = useRef<{ x: number; y: number } | null>(null);
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [dirty, setDirty] = useState(false);
	/** 캔버스 픽셀 기준 지우개 굵기 */
	const [brushSize, setBrushSize] = useState(BRUSH_DEFAULT);
	const brushSizeRef = useRef(brushSize);
	brushSizeRef.current = brushSize;
	/** 화면 좌표 — 크기 미리보기 원 */
	const [cursorScreen, setCursorScreen] = useState<{
		x: number;
		y: number;
		radius: number;
	} | null>(null);

	const exportCanvas = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		canvas.toBlob((blob) => {
			if (!blob) return;
			// blob URL 해제는 부모가 setFromUrl로 교체할 때 한다.
			// 여기서 revoke하면 STEP3 진입 시 언마운트와 겹쳐 로드가 깨진다.
			onChange(URL.createObjectURL(blob));
		}, "image/png");
	}, [onChange]);

	const paintOriginal = useCallback(async () => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		setReady(false);
		setError(null);
		try {
			const image = await loadImage(originalUrl);
			const maxSide = 900;
			const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
			const width = Math.max(1, Math.round(image.width * scale));
			const height = Math.max(1, Math.round(image.height * scale));
			canvas.width = width;
			canvas.height = height;
			// CSS 크기는 비율을 유지한 채 바깥 스테이지에 맞춘다 (object-fit 사용 안 함).
			const stage = canvas.parentElement?.parentElement;
			const maxW = Math.max(1, (stage?.clientWidth ?? 700) - 16);
			const maxH = Math.max(1, (stage?.clientHeight ?? 360) - 16);
			const fit = Math.min(maxW / width, maxH / height, 1);
			canvas.style.width = `${Math.round(width * fit)}px`;
			canvas.style.height = `${Math.round(height * fit)}px`;
			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("캔버스를 초기화하지 못했습니다.");
			ctx.clearRect(0, 0, width, height);
			ctx.drawImage(image, 0, 0, width, height);
			setDirty(false);
			setReady(true);
			onChange(originalUrl);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "도안을 불러오지 못했습니다.",
			);
		}
	}, [originalUrl, onChange]);

	useEffect(() => {
		void paintOriginal();
		// originalUrl이 바뀔 때만 원본을 다시 깐다
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [originalUrl]);

	const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		const canvas = event.currentTarget;
		const bounds = canvas.getBoundingClientRect();
		// object-fit 없이 요소 박스 = 비트맵 표시 영역이어야 포인터·지우개가 일치한다.
		const scaleX = canvas.width / Math.max(1, bounds.width);
		const scaleY = canvas.height / Math.max(1, bounds.height);
		const screenX = event.clientX - bounds.left;
		const screenY = event.clientY - bounds.top;
		return {
			x: screenX * scaleX,
			y: screenY * scaleY,
			screenX,
			screenY,
			displayScale: 1 / scaleX,
		};
	};

	const updateCursorPreview = (
		event: ReactPointerEvent<HTMLCanvasElement>,
	) => {
		const { screenX, screenY, displayScale } = pointFromEvent(event);
		setCursorScreen({
			x: screenX,
			y: screenY,
			radius: (brushSizeRef.current * displayScale) / 2,
		});
	};

	const brushWidth = () => brushSizeRef.current;

	const eraseTo = (from: { x: number; y: number }, to: { x: number; y: number }) => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return;
		ctx.save();
		ctx.globalCompositeOperation = "destination-out";
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.lineWidth = brushWidth();
		ctx.beginPath();
		ctx.moveTo(from.x, from.y);
		ctx.lineTo(to.x, to.y);
		ctx.stroke();
		ctx.restore();
	};

	const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		if (!ready) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		drawingRef.current = true;
		const point = pointFromEvent(event);
		lastPointRef.current = point;
		eraseTo(point, point);
		setDirty(true);
		updateCursorPreview(event);
	};

	const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		updateCursorPreview(event);
		if (!drawingRef.current || !lastPointRef.current) return;
		const point = pointFromEvent(event);
		eraseTo(lastPointRef.current, point);
		lastPointRef.current = point;
	};

	const endStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		updateCursorPreview(event);
		if (!drawingRef.current) return;
		drawingRef.current = false;
		lastPointRef.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		exportCanvas();
	};

	return (
		<div className="mx-auto flex h-full max-h-[400px] min-h-[240px] w-full max-w-[700px] flex-col overflow-hidden rounded-[12px] border border-black/10 bg-white">
			<div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-black/5 px-3 py-2">
				<p className="text-[12px] font-light text-black/50">
					지우고 싶은 부분을 문질러 주세요
				</p>
				<div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
					<label className="flex min-w-[140px] max-w-[220px] flex-1 items-center gap-2">
						<span className="shrink-0 text-[11px] font-semibold text-black/55">
							크기
						</span>
						<input
							type="range"
							min={BRUSH_MIN}
							max={BRUSH_MAX}
							value={brushSize}
							onChange={(event) => setBrushSize(Number(event.target.value))}
							aria-label="지우개 크기"
							className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-black/10 accent-brand"
						/>
						<span
							className="flex size-7 shrink-0 items-center justify-center"
							aria-hidden>
							<span
								className="rounded-full border border-black/35 bg-black/10"
								style={{
									width: `${6 + ((brushSize - BRUSH_MIN) / (BRUSH_MAX - BRUSH_MIN)) * 14}px`,
									height: `${6 + ((brushSize - BRUSH_MIN) / (BRUSH_MAX - BRUSH_MIN)) * 14}px`,
								}}
							/>
						</span>
					</label>
					<span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
						<EraserIcon />
						지우개
					</span>
					<button
						type="button"
						disabled={!dirty || !ready}
						onClick={() => void paintOriginal()}
						className="inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-white px-3 py-1 text-[12px] font-semibold text-black/70 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40">
						<RestoreIcon />
						원상복귀
					</button>
				</div>
			</div>

			<div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#f5f5f5] p-2">
				{/* relative 박스는 캔버스와 같은 크기여야 미리보기 원이 포인터와 맞는다 */}
				<div className="relative w-fit max-h-full max-w-full">
					<canvas
						ref={canvasRef}
						aria-label="도안 지우개 캔버스"
						onPointerDown={handlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={endStroke}
						onPointerCancel={endStroke}
						onPointerLeave={() => setCursorScreen(null)}
						style={ready ? { cursor: "none" } : undefined}
						className={`touch-none ${ready ? "block" : "invisible"}`}
					/>
					{ready && cursorScreen && (
						<span
							aria-hidden
							className="pointer-events-none absolute rounded-full border border-black/70 bg-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]"
							style={{
								width: cursorScreen.radius * 2,
								height: cursorScreen.radius * 2,
								left: cursorScreen.x - cursorScreen.radius,
								top: cursorScreen.y - cursorScreen.radius,
							}}
						/>
					)}
				</div>
				{!ready && !error && (
					<p className="absolute text-[13px] font-light text-black/40">
						도안을 불러오는 중…
					</p>
				)}
				{error && (
					<p className="absolute px-4 text-center text-[13px] font-light text-brand">
						{error}
					</p>
				)}
			</div>
		</div>
	);
}
