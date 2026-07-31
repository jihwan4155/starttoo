import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
	buildMaskDataUrl,
	drawPreview,
	isDrawableStroke,
} from "./maskPainter";
import type { Point, Stroke } from "./maskPainter";
import { MASK_H, MASK_W, MODES } from "./shapeSearchConstants";
import type { SearchMode } from "../../types/shapeSearch";

/**
 * 가릴 부위를 그리는 획 상태를 들고 있다.
 *
 * <p>화면에 보이는 그림과 서버로 보내는 마스크는 서로 다른 캔버스다. 두 그리기
 * 규칙은 maskPainter에 나란히 두었고, 이 훅은 상태와 입력만 담당한다.
 */
export default function useCanvasStrokes(mode: SearchMode) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	// 그리는 중 여부는 리렌더와 무관하게 즉시 반영돼야 하므로 ref로 관리
	const drawingRef = useRef(false);

	const [strokes, setStrokes] = useState<Stroke[]>([]);
	const [brush, setBrush] = useState<number>(MODES[mode].brush);
	// 사진은 비동기로 로드되고 로드가 끝나면 다시 그려야 하므로 state로 둔다
	const [photo, setPhoto] = useState<HTMLImageElement | null>(null);

	/**
	 * 화면 캔버스를 다시 그린다.
	 *
	 * <p>호출 주체는 ShapeCanvas의 이펙트다. 단계 이동으로 캔버스가 언마운트·
	 * 재마운트되어도 이 훅의 state는 남으므로, 캔버스가 화면에 붙는 시점에 맞춰
	 * 그려야 빈 캔버스로 돌아오지 않는다.
	 */
	const redraw = useCallback(() => {
		const ctx = canvasRef.current?.getContext("2d");
		if (!ctx) return;
		drawPreview(ctx, { strokes, brush, mode, photo });
	}, [strokes, brush, mode, photo]);

	/** 서버로 보낼 마스크. 그릴 획이 없으면 null */
	const buildMask = useCallback(
		() => buildMaskDataUrl(strokes, brush),
		[strokes, brush],
	);

	/** 배경 사진 교체. null이면 회색 배경으로 되돌린다 */
	const loadPhoto = useCallback((src: string | null) => {
		if (!src) {
			setPhoto(null);
			return;
		}
		const image = new Image();
		image.onload = () => setPhoto(image);
		image.src = src;
	}, []);

	const undo = useCallback(() => {
		setStrokes((previous) => previous.slice(0, -1));
	}, []);

	const clear = useCallback(() => {
		setStrokes([]);
	}, []);

	/** 모드 기본 붓 굵기로 되돌린다 */
	const resetBrush = useCallback((next: SearchMode) => {
		setBrush(MODES[next].brush);
	}, []);

	/**
	 * 포인터 좌표를 마스크 좌표계(MASK_W×MASK_H)로 환산한다.
	 * CSS로 축소돼 있어도 이 비율 보정 덕분에 마스크는 항상 원본 해상도로 남는다.
	 */
	const pointFrom = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
		const rect = event.currentTarget.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * MASK_W,
			y: ((event.clientY - rect.top) / rect.height) * MASK_H,
		};
	};

	const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		if (event.button !== 0 && event.pointerType === "mouse") return;
		event.currentTarget.setPointerCapture(event.pointerId);
		drawingRef.current = true;
		setStrokes((previous) => [...previous, [pointFrom(event)]]);
	};

	const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		if (!drawingRef.current) return;
		const point = pointFrom(event);
		setStrokes((previous) => {
			// pointerdown이 만든 획이 아직 반영되지 않았으면 이번 이동은 버린다
			if (previous.length === 0) return previous;
			const next = [...previous];
			next[next.length - 1] = [...next[next.length - 1], point];
			return next;
		});
	};

	const handlePointerUp = () => {
		drawingRef.current = false;
	};

	return {
		canvasRef,
		brush,
		setBrush,
		resetBrush,
		// 점 하나만 찍은 획은 마스크에 아무것도 남기지 않으므로 비어 있는 것으로 본다
		isEmpty: !strokes.some(isDrawableStroke),
		canUndo: strokes.length > 0,
		undo,
		clear,
		loadPhoto,
		redraw,
		buildMask,
		handlers: {
			onPointerDown: handlePointerDown,
			onPointerMove: handlePointerMove,
			onPointerUp: handlePointerUp,
			onPointerCancel: handlePointerUp,
		},
	};
}
