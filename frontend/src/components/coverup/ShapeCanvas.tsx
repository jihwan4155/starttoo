import { useEffect } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { MASK_H, MASK_W } from "./shapeSearchConstants";

type PointerHandlers = {
	onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
	onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
	onPointerUp: () => void;
	onPointerCancel: () => void;
};

type ShapeCanvasProps = {
	canvasRef: RefObject<HTMLCanvasElement | null>;
	/** useCanvasStrokes의 redraw. 마운트·변경 시점에 화면을 다시 그린다 */
	redraw: () => void;
	handlers: PointerHandlers;
	/** false면 보기 전용 (STEP 1 업로드 미리보기) */
	drawable?: boolean;
};

/**
 * 화면용 캔버스.
 *
 * <p>width·height 속성은 마스크 좌표계(420×520)로 고정한다. 화면에서 줄어드는 것은
 * CSS만 담당하고, 포인터 좌표는 useCanvasStrokes가 비율로 환산한다. 여기에
 * devicePixelRatio 배율을 걸면 마스크 픽셀 크기가 틀어져 검색 품질이 조용히
 * 나빠지므로 절대 걸지 않는다.
 */
export default function ShapeCanvas({
	canvasRef,
	redraw,
	handlers,
	drawable = false,
}: ShapeCanvasProps) {
	// redraw는 획·붓·모드·사진에 따라 갱신되므로 마운트와 변경 모두 여기서 처리된다
	useEffect(() => {
		redraw();
	}, [redraw]);

	return (
		<canvas
			ref={canvasRef}
			width={MASK_W}
			height={MASK_H}
			aria-label={drawable ? "가릴 부위를 그리는 캔버스" : "업로드한 부위 사진"}
			className={`mx-auto h-auto w-full rounded-[10px] border border-black/10 bg-[#f4f4f5] ${
				drawable ? "cursor-crosshair touch-none" : ""
			}`}
			// Tailwind는 런타임 값으로 클래스를 만들 수 없어 상한만 인라인으로 준다
			style={{ maxWidth: MASK_W }}
			{...(drawable ? handlers : {})}
		/>
	);
}
