import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export type DoodleTool = "pen" | "eraser";

type Point = { x: number; y: number };

type DoodleStroke = {
	points: Point[];
	/** CSS px 기준 선 두께 */
	width: number;
	color: string;
	/** true면 지우개 — 기존 픽셀을 지움 */
	erase: boolean;
};

type UseDoodleCanvasOptions = {
	/** 펜 색상 (기본 검정) */
	color?: string;
};

/** 두 점의 중간점 — 곡선 보간의 시작·끝점으로 사용 */
function midpoint(a: Point, b: Point): Point {
	return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function applyBrush(ctx: CanvasRenderingContext2D, stroke: DoodleStroke) {
	ctx.lineWidth = stroke.width;
	ctx.strokeStyle = stroke.color;
	ctx.fillStyle = stroke.color;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.globalCompositeOperation = stroke.erase
		? "destination-out"
		: "source-over";
}

/**
 * points[index]로 이어지는 한 구간을 그린다.
 * 앞뒤 점의 중간점을 잇고 실제 점을 제어점으로 써서 각지지 않게 만든다.
 */
function drawSegment(
	ctx: CanvasRenderingContext2D,
	stroke: DoodleStroke,
	index: number
) {
	const points = stroke.points;
	applyBrush(ctx, stroke);
	ctx.beginPath();
	if (index === 1) {
		// 점이 2개뿐이면 곡선을 만들 수 없어 직선으로 잇는다
		ctx.moveTo(points[0].x, points[0].y);
		ctx.lineTo(points[1].x, points[1].y);
	} else {
		const control = points[index - 1];
		const start = midpoint(points[index - 2], control);
		const end = midpoint(control, points[index]);
		ctx.moveTo(start.x, start.y);
		ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
	}
	ctx.stroke();
}

/** 중간점 보간은 마지막 점 직전에서 끝나므로 꼬리 구간을 따로 이어준다 */
function drawTail(ctx: CanvasRenderingContext2D, stroke: DoodleStroke) {
	const points = stroke.points;
	if (points.length < 3) return;
	const last = points[points.length - 1];
	const start = midpoint(points[points.length - 2], last);
	applyBrush(ctx, stroke);
	ctx.beginPath();
	ctx.moveTo(start.x, start.y);
	ctx.lineTo(last.x, last.y);
	ctx.stroke();
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: DoodleStroke) {
	const points = stroke.points;
	if (points.length === 0) return;
	if (points.length === 1) {
		// 톡 찍은 점은 원으로 표현
		applyBrush(ctx, stroke);
		ctx.beginPath();
		ctx.arc(points[0].x, points[0].y, stroke.width / 2, 0, Math.PI * 2);
		ctx.fill();
		return;
	}
	for (let i = 1; i < points.length; i += 1) drawSegment(ctx, stroke, i);
	drawTail(ctx, stroke);
}

/**
 * 메인 그림판의 드로잉 엔진.
 * 획을 좌표 배열로 들고 있어 undo·redo와 리사이즈 후 재렌더가 가능하다.
 */
export default function useDoodleCanvas({
	color = "#000000",
}: UseDoodleCanvasOptions = {}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const strokesRef = useRef<DoodleStroke[]>([]);
	const redoRef = useRef<DoodleStroke[]>([]);
	// 그리는 중인 획 — 리렌더와 무관하게 즉시 반영돼야 하므로 ref로 관리
	const activeRef = useRef<DoodleStroke | null>(null);

	const [tool, setTool] = useState<DoodleTool>("pen");
	const [size, setSize] = useState(4);
	// 버튼 활성화 판단용 — 획이 바뀔 때만 갱신
	const [counts, setCounts] = useState({ strokes: 0, redos: 0 });

	const syncCounts = useCallback(() => {
		setCounts({
			strokes: strokesRef.current.length,
			redos: redoRef.current.length,
		});
	}, []);

	const getContext = () => canvasRef.current?.getContext("2d") ?? null;

	const redraw = useCallback(() => {
		const canvas = canvasRef.current;
		const ctx = getContext();
		if (!canvas || !ctx) return;
		// 변환이 걸려 있어도 전체가 지워지도록 기본 좌표계로 되돌려 클리어
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.restore();
		strokesRef.current.forEach((stroke) => drawStroke(ctx, stroke));
		ctx.globalCompositeOperation = "source-over";
	}, []);

	// 부모 박스 크기에 맞춰 캔버스 해상도를 잡고(고DPI 대응) 다시 그린다.
	// 크기가 이미 맞으면 아무것도 하지 않으므로 몇 번을 불러도 안전하다.
	const syncSize = useCallback(() => {
		const canvas = canvasRef.current;
		const parent = canvas?.parentElement;
		if (!canvas || !parent) return;
		const dpr = window.devicePixelRatio || 1;
		const { width, height } = parent.getBoundingClientRect();
		if (width === 0 || height === 0) return;
		const nextWidth = Math.round(width * dpr);
		const nextHeight = Math.round(height * dpr);
		if (canvas.width === nextWidth && canvas.height === nextHeight) return;
		canvas.width = nextWidth;
		canvas.height = nextHeight;
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		// width 대입으로 컨텍스트가 초기화되므로 배율을 다시 걸어준다
		getContext()?.setTransform(dpr, 0, 0, dpr, 0, 0);
		redraw();
	}, [redraw]);

	useEffect(() => {
		const parent = canvasRef.current?.parentElement;
		if (!parent) return;
		syncSize();
		const observer = new ResizeObserver(syncSize);
		observer.observe(parent);
		return () => observer.disconnect();
	}, [syncSize]);

	const pointFrom = (e: ReactPointerEvent<HTMLCanvasElement>): Point => {
		const rect = e.currentTarget.getBoundingClientRect();
		return { x: e.clientX - rect.left, y: e.clientY - rect.top };
	};

	const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
		if (e.button !== 0 && e.pointerType === "mouse") return;
		// 화면에 그려지지 않는 탭에서 마운트되면 ResizeObserver가 늦게 돌아
		// 캔버스가 기본 크기(300x150)로 남는다. 첫 입력 때 한 번 더 맞춰준다.
		syncSize();
		e.currentTarget.setPointerCapture(e.pointerId);
		const stroke: DoodleStroke = {
			points: [pointFrom(e)],
			// 지우개는 같은 두께로는 잘 안 지워져서 조금 넉넉하게
			width: tool === "eraser" ? size * 3 : size,
			color,
			erase: tool === "eraser",
		};
		activeRef.current = stroke;
		strokesRef.current.push(stroke);
		// 새로 그리기 시작하면 되돌린 획은 버린다
		redoRef.current = [];
		const ctx = getContext();
		if (ctx) drawStroke(ctx, stroke);
	};

	const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
		const stroke = activeRef.current;
		const ctx = getContext();
		if (!stroke || !ctx) return;
		const point = pointFrom(e);
		const last = stroke.points[stroke.points.length - 1];
		// 미세한 흔들림은 버려 점이 과하게 쌓이지 않게 한다
		if (Math.hypot(point.x - last.x, point.y - last.y) < 1) return;
		stroke.points.push(point);
		// 새로 늘어난 구간만 덧그려 매 이동마다 전체 재렌더를 피한다
		drawSegment(ctx, stroke, stroke.points.length - 1);
	};

	const handlePointerUp = () => {
		const stroke = activeRef.current;
		if (!stroke) return;
		activeRef.current = null;
		const ctx = getContext();
		if (ctx) {
			drawTail(ctx, stroke);
			ctx.globalCompositeOperation = "source-over";
		}
		syncCounts();
	};

	const undo = useCallback(() => {
		const stroke = strokesRef.current.pop();
		if (!stroke) return;
		redoRef.current.push(stroke);
		redraw();
		syncCounts();
	}, [redraw, syncCounts]);

	const redo = useCallback(() => {
		const stroke = redoRef.current.pop();
		if (!stroke) return;
		strokesRef.current.push(stroke);
		redraw();
		syncCounts();
	}, [redraw, syncCounts]);

	const clear = useCallback(() => {
		strokesRef.current = [];
		redoRef.current = [];
		redraw();
		syncCounts();
	}, [redraw, syncCounts]);

	// Ctrl/Cmd+Z 되돌리기, Ctrl/Cmd+Shift+Z 다시 실행
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
			const target = e.target as HTMLElement | null;
			// 입력 중에는 브라우저 기본 동작을 그대로 둔다
			if (target?.closest("input, textarea, [contenteditable='true']")) return;
			e.preventDefault();
			if (e.shiftKey) redo();
			else undo();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [undo, redo]);

	/**
	 * 그린 영역만 잘라 흰 배경에 얹은 PNG로 내보낸다.
	 * 추천 API가 바로 받을 수 있도록 File로 반환하며, 빈 캔버스면 null.
	 */
	const toFile = useCallback(async (fileName = "doodle.png") => {
		const strokes = strokesRef.current.filter((stroke) => !stroke.erase);
		if (strokes.length === 0) return null;

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		strokes.forEach((stroke) => {
			const half = stroke.width / 2;
			stroke.points.forEach(({ x, y }) => {
				minX = Math.min(minX, x - half);
				minY = Math.min(minY, y - half);
				maxX = Math.max(maxX, x + half);
				maxY = Math.max(maxY, y + half);
			});
		});

		const padding = 32;
		const width = Math.max(Math.ceil(maxX - minX) + padding * 2, 256);
		const height = Math.max(Math.ceil(maxY - minY) + padding * 2, 256);

		// 지우개(destination-out)가 흰 배경을 뚫지 않도록 투명 레이어에 먼저 그린다
		const layer = document.createElement("canvas");
		layer.width = width;
		layer.height = height;
		const layerCtx = layer.getContext("2d");
		if (!layerCtx) return null;
		layerCtx.translate(-minX + padding, -minY + padding);
		strokesRef.current.forEach((stroke) => drawStroke(layerCtx, stroke));

		const output = document.createElement("canvas");
		output.width = width;
		output.height = height;
		const outputCtx = output.getContext("2d");
		if (!outputCtx) return null;
		outputCtx.fillStyle = "#ffffff";
		outputCtx.fillRect(0, 0, width, height);
		outputCtx.drawImage(layer, 0, 0);

		const blob = await new Promise<Blob | null>((resolve) =>
			output.toBlob(resolve, "image/png")
		);
		return blob ? new File([blob], fileName, { type: "image/png" }) : null;
	}, []);

	return {
		canvasRef,
		tool,
		setTool,
		size,
		setSize,
		isEmpty: counts.strokes === 0,
		canUndo: counts.strokes > 0,
		canRedo: counts.redos > 0,
		undo,
		redo,
		clear,
		toFile,
		handlers: {
			onPointerDown: handlePointerDown,
			onPointerMove: handlePointerMove,
			onPointerUp: handlePointerUp,
			onPointerCancel: handlePointerUp,
		},
	};
}
