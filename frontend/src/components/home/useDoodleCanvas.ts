import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
	BRUSH_PX,
	MASK_H,
	MASK_W,
} from "../coverup/shapeSearchConstants";

export type DoodleTool = "pen" | "eraser";

/** 회전 버튼 한 번에 도는 각도 */
export const ROTATION_STEP = 15;

type Point = { x: number; y: number };

type DoodleStroke = {
	points: Point[];
	/** CSS px 기준 선 두께 */
	width: number;
	color: string;
	/** true면 지우개 — 기존 픽셀을 지움 */
	erase: boolean;
};

/**
 * 획(종이 좌표)을 화면에 얹을 때 거치는 변환.
 *
 * <p>중심을 기준으로 rad 만큼 돌리고 scale 만큼 줄인다. scale은 회전 때문에
 * 캔버스 밖으로 밀려나는 획이 생기면 자동으로 1보다 작아진다.
 */
type CanvasView = {
	rad: number;
	scale: number;
	cx: number;
	cy: number;
};

const IDENTITY_VIEW: CanvasView = { rad: 0, scale: 1, cx: 0, cy: 0 };

type UseDoodleCanvasOptions = {
	/** 펜 색상 (기본 검정) */
	color?: string;
};

/** 두 점의 중간점 — 곡선 보간의 시작·끝점으로 사용 */
function midpoint(a: Point, b: Point): Point {
	return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** 종이 좌표 → 화면 좌표 (회전·축소 적용) */
function project(point: Point, view: CanvasView): Point {
	const cos = Math.cos(view.rad);
	const sin = Math.sin(view.rad);
	const dx = point.x - view.cx;
	const dy = point.y - view.cy;
	return {
		x: view.cx + view.scale * (dx * cos - dy * sin),
		y: view.cy + view.scale * (dx * sin + dy * cos),
	};
}

/** 화면 좌표 → 종이 좌표 (project의 역변환) */
function unproject(point: Point, view: CanvasView): Point {
	const cos = Math.cos(-view.rad);
	const sin = Math.sin(-view.rad);
	const dx = (point.x - view.cx) / view.scale;
	const dy = (point.y - view.cy) / view.scale;
	return {
		x: view.cx + dx * cos - dy * sin,
		y: view.cy + dx * sin + dy * cos,
	};
}

/** 화면에 보이는 그대로의 획 — 내보내기(마스크·PNG)는 이걸 쓴다 */
function projectStroke(stroke: DoodleStroke, view: CanvasView): DoodleStroke {
	if (view.rad === 0 && view.scale === 1) return stroke;
	return {
		...stroke,
		points: stroke.points.map((point) => project(point, view)),
		width: stroke.width * view.scale,
	};
}

/**
 * 지금 회전값으로 획을 돌렸을 때 캔버스 밖으로 나가지 않을 축소 배율.
 *
 * <p>회전만 걸면 모서리 쪽 획이 잘려 나가 "돌렸더니 그림이 사라졌다"가 된다.
 * 넘치는 만큼만 줄여 항상 전체가 보이게 한다(안 넘치면 1 그대로).
 */
function fitScale(
	strokes: DoodleStroke[],
	rad: number,
	cx: number,
	cy: number,
): number {
	if (rad === 0 || cx <= 0 || cy <= 0) return 1;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	let overflow = 1;
	strokes.forEach((stroke) => {
		const half = stroke.width / 2;
		stroke.points.forEach(({ x, y }) => {
			const dx = x - cx;
			const dy = y - cy;
			const rx = Math.abs(dx * cos - dy * sin) + half;
			const ry = Math.abs(dx * sin + dy * cos) + half;
			overflow = Math.max(overflow, rx / cx, ry / cy);
		});
	});
	return 1 / overflow;
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

/** 회전 각도를 (-180, 180] 범위로 접는다 — 배지에 -165° 대신 195°가 뜨지 않게 */
function normalizeDegrees(deg: number): number {
	const wrapped = ((deg % 360) + 360) % 360;
	return wrapped > 180 ? wrapped - 360 : wrapped;
}

/**
 * 메인 그림판의 드로잉 엔진.
 * 획을 좌표 배열로 들고 있어 undo·redo와 리사이즈 후 재렌더가 가능하다.
 */
export default function useDoodleCanvas({
	color = "#000000",
}: UseDoodleCanvasOptions = {}) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const observerRef = useRef<ResizeObserver | null>(null);
	const strokesRef = useRef<DoodleStroke[]>([]);
	const redoRef = useRef<DoodleStroke[]>([]);
	// 그리는 중인 획 — 리렌더와 무관하게 즉시 반영돼야 하므로 ref로 관리
	const activeRef = useRef<DoodleStroke | null>(null);
	// 캔버스의 CSS 크기·배율. 그리기 좌표 계산이 리렌더와 무관해야 해서 ref로 둔다.
	const sizeRef = useRef({ width: 0, height: 0 });
	const dprRef = useRef(1);
	const rotationRef = useRef(0);
	// 화면 변환은 redraw 시점에만 갱신한다. 획을 긋는 도중에 배율이 바뀌면
	// 선이 손끝에서 미끄러지므로, 한 획이 끝나기 전에는 고정돼 있어야 한다.
	const viewRef = useRef<CanvasView>(IDENTITY_VIEW);

	const [tool, setTool] = useState<DoodleTool>("pen");
	const [size, setSize] = useState(4);
	const [rotation, setRotation] = useState(0);
	// 버튼 활성화 판단용 — 획이 바뀔 때만 갱신
	const [counts, setCounts] = useState({ strokes: 0, redos: 0 });

	const syncCounts = useCallback(() => {
		setCounts({
			strokes: strokesRef.current.length,
			redos: redoRef.current.length,
		});
	}, []);

	const getContext = () => canvasRef.current?.getContext("2d") ?? null;

	/** 지금 회전값·캔버스 크기로 화면 변환을 다시 계산해 둔다 */
	const updateView = useCallback(() => {
		const { width, height } = sizeRef.current;
		const rad = (rotationRef.current * Math.PI) / 180;
		const cx = width / 2;
		const cy = height / 2;
		viewRef.current = {
			rad,
			cx,
			cy,
			scale: fitScale(strokesRef.current, rad, cx, cy),
		};
		return viewRef.current;
	}, []);

	/** 고DPI 배율 + 회전·축소를 컨텍스트에 건다 (이후 그리기는 종이 좌표계) */
	const applyTransform = useCallback((ctx: CanvasRenderingContext2D) => {
		const { rad, scale, cx, cy } = viewRef.current;
		ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);
		ctx.translate(cx, cy);
		ctx.scale(scale, scale);
		ctx.rotate(rad);
		ctx.translate(-cx, -cy);
	}, []);

	const redraw = useCallback(() => {
		const canvas = canvasRef.current;
		const ctx = getContext();
		if (!canvas || !ctx) return;
		updateView();
		// 변환이 걸려 있어도 전체가 지워지도록 기본 좌표계로 되돌려 클리어
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		applyTransform(ctx);
		strokesRef.current.forEach((stroke) => drawStroke(ctx, stroke));
		ctx.globalCompositeOperation = "source-over";
	}, [applyTransform, updateView]);

	/** 부모 박스 크기를 캔버스 해상도에 반영한다. 바뀐 게 없으면 false */
	const measure = useCallback((force: boolean) => {
		const canvas = canvasRef.current;
		const parent = canvas?.parentElement;
		if (!canvas || !parent) return false;
		const dpr = window.devicePixelRatio || 1;
		const { width, height } = parent.getBoundingClientRect();
		if (width === 0 || height === 0) return false;
		const nextWidth = Math.round(width * dpr);
		const nextHeight = Math.round(height * dpr);
		if (!force && canvas.width === nextWidth && canvas.height === nextHeight) {
			return false;
		}
		canvas.width = nextWidth;
		canvas.height = nextHeight;
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		dprRef.current = dpr;
		sizeRef.current = { width, height };
		return true;
	}, []);

	// 부모 박스 크기에 맞춰 캔버스 해상도를 잡고(고DPI 대응) 다시 그린다.
	// 크기가 이미 맞으면 아무것도 하지 않으므로 몇 번을 불러도 안전하다.
	const syncSize = useCallback(() => {
		if (measure(false)) redraw();
	}, [measure, redraw]);

	/** 캔버스 크기를 맞추고 저장된 획을 다시 그린다 (모달 재오픈 등) */
	const refresh = useCallback(() => {
		if (measure(true)) redraw();
	}, [measure, redraw]);

	/*
	 * 캔버스는 ref 콜백으로 잡는다.
	 *
	 * 예전에는 useEffect에서 한 번만 붙였는데, 결과 화면을 보고 낙서장으로 돌아오면
	 * canvas 엘리먼트는 새로 마운트되는 반면 이펙트는 다시 돌지 않았다. 그래서 저장된
	 * 획이 그대로 있는데도 화면은 빈 캔버스였고, 한 번 눌러야(=pointerdown의 syncSize)
	 * 되살아났다. 마운트 시점에 붙는 ref 콜백이면 그 틈이 없다.
	 */
	const attachCanvas = useCallback(
		(node: HTMLCanvasElement | null) => {
			observerRef.current?.disconnect();
			observerRef.current = null;
			canvasRef.current = node;
			if (!node) return;
			refresh();
			const parent = node.parentElement;
			if (!parent) return;
			const observer = new ResizeObserver(() => syncSize());
			observer.observe(parent);
			observerRef.current = observer;
		},
		[refresh, syncSize],
	);

	useEffect(() => () => observerRef.current?.disconnect(), []);

	/** 화면(CSS px) 좌표를 획이 저장되는 종이 좌표로 되돌린다 */
	const pointFrom = (e: ReactPointerEvent<HTMLCanvasElement>): Point => {
		const rect = e.currentTarget.getBoundingClientRect();
		return unproject(
			{ x: e.clientX - rect.left, y: e.clientY - rect.top },
			viewRef.current,
		);
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
		rotationRef.current = 0;
		setRotation(0);
		redraw();
		syncCounts();
	}, [redraw, syncCounts]);

	/**
	 * 그림 전체를 캔버스 중심 기준으로 돌린다.
	 *
	 * <p>획 좌표는 그대로 두고 보는 각도만 바꾼다 — 여러 번 돌려도 좌표가 누적
	 * 반올림되지 않고, 0°로 되돌리면 처음 그린 그대로다. 검색 마스크도 화면에
	 * 보이는 각도로 나간다.
	 */
	const rotateBy = useCallback(
		(deltaDeg: number) => {
			rotationRef.current = normalizeDegrees(rotationRef.current + deltaDeg);
			setRotation(rotationRef.current);
			redraw();
		},
		[redraw],
	);

	const resetRotation = useCallback(() => {
		if (rotationRef.current === 0) return;
		rotationRef.current = 0;
		setRotation(0);
		redraw();
	}, [redraw]);

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
		if (strokesRef.current.every((stroke) => stroke.erase)) return null;
		const view = viewRef.current;
		// 화면에 보이는 각도 그대로 내보낸다
		const drawn = strokesRef.current.map((stroke) =>
			projectStroke(stroke, view),
		);

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		drawn.forEach((stroke) => {
			if (stroke.erase) return;
			const half = stroke.width / 2;
			stroke.points.forEach(({ x, y }) => {
				minX = Math.min(minX, x - half);
				minY = Math.min(minY, y - half);
				maxX = Math.max(maxX, x + half);
				maxY = Math.max(maxY, y + half);
			});
		});
		if (!Number.isFinite(minX)) return null;

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
		drawn.forEach((stroke) => drawStroke(layerCtx, stroke));

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

	/**
	 * 낙서 획을 형태 검색 엔진 규격(420×520, 검은 배경 + 흰 선)으로 변환한다.
	 * 가로형 낙서장의 비율은 유지하고 남는 위아래 공간에는 검은 여백을 둔다.
	 */
	const buildSearchMask = useCallback(() => {
		const sourceCanvas = canvasRef.current;
		const sourceRect = sourceCanvas?.getBoundingClientRect();
		if (
			!sourceCanvas ||
			!sourceRect ||
			sourceRect.width === 0 ||
			sourceRect.height === 0 ||
			!strokesRef.current.some(
				(stroke) => !stroke.erase && stroke.points.length >= 2,
			)
		) {
			return null;
		}

		const output = document.createElement("canvas");
		output.width = MASK_W;
		output.height = MASK_H;
		const ctx = output.getContext("2d", { willReadFrequently: true });
		if (!ctx) return null;

		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, MASK_W, MASK_H);

		const pointScale = Math.min(
			MASK_W / sourceRect.width,
			MASK_H / sourceRect.height,
		);
		const offsetX = (MASK_W - sourceRect.width * pointScale) / 2;
		const offsetY = (MASK_H - sourceRect.height * pointScale) / 2;
		// 낙서장의 '보통 선'(4px)을 검색 엔진의 shape 기준 굵기(6px)에 맞춘다.
		const widthScale = BRUSH_PX.shape / 4;
		const view = viewRef.current;

		strokesRef.current.forEach((stroke) => {
			// 회전·축소를 먼저 먹인다 — 화면에 보이는 모양 그대로 검색해야 한다
			const shown = projectStroke(stroke, view);
			const maskStroke: DoodleStroke = {
				points: shown.points.map(({ x, y }) => ({
					x: offsetX + x * pointScale,
					y: offsetY + y * pointScale,
				})),
				width: Math.max(1, shown.width * widthScale),
				color: stroke.erase ? "#000" : "#fff",
				// 검은색으로 덮어 지워야 최종 PNG의 배경도 불투명한 검정으로 남는다.
				erase: false,
			};
			drawStroke(ctx, maskStroke);
		});

		const pixels = ctx.getImageData(0, 0, MASK_W, MASK_H).data;
		for (let index = 0; index < pixels.length; index += 4) {
			if (pixels[index] > 10) return output.toDataURL("image/png");
		}
		return null;
	}, []);

	return {
		canvasRef: attachCanvas,
		tool,
		setTool,
		size,
		setSize,
		rotation,
		rotateBy,
		resetRotation,
		isEmpty: counts.strokes === 0,
		canUndo: counts.strokes > 0,
		canRedo: counts.redos > 0,
		undo,
		redo,
		clear,
		toFile,
		buildSearchMask,
		refresh,
		handlers: {
			onPointerDown: handlePointerDown,
			onPointerMove: handlePointerMove,
			onPointerUp: handlePointerUp,
			onPointerCancel: handlePointerUp,
		},
	};
}
