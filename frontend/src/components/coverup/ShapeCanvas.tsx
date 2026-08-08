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
};

/**
 * 화면용 캔버스.
 *
 * <p>width·height 속성은 마스크 좌표계(420×520)로 고정한다. 화면에서 줄어드는 것은
 * CSS만 담당하고, 포인터 좌표는 useCanvasStrokes가 비율로 환산한다. 여기에
 * devicePixelRatio 배율을 걸면 마스크 픽셀 크기가 틀어져 검색 품질이 조용히
 * 나빠지므로 절대 걸지 않는다.
 *
 * <p>CSS 크기는 h-full + w-auto로 준다. 캔버스는 대체 요소라 고유 비율(420:520)을
 * 유지하므로 높이만 정해 주면 너비가 따라오고, 부모가 준 높이를 남김없이 쓴다.
 * max-h/max-w만 걸면 반대로 420×520 CSS px보다 커지지 못해, 넓은 화면에서도 그림판이
 * 손바닥만 하게 남는다. max-*는 부모보다 커지지 않게 하는 안전장치로만 남긴다.
 *
 * <p>object-contain은 그 안전장치가 걸렸을 때를 위한 것이다. 세로로 긴 부모에서는
 * max-w-full이 너비만 깎고 높이는 그대로 두어 그림이 옆으로 눌리는데, contain이면
 * 상자 안에 비율대로 들어간다. 대신 상자와 그림이 어긋날 수 있으므로 포인터 좌표는
 * useCanvasStrokes가 같은 규칙으로 환산한다.
 */
export default function ShapeCanvas({
	canvasRef,
	redraw,
	handlers,
}: ShapeCanvasProps) {
	// redraw는 획·모드·사진에 따라 갱신되므로 마운트와 변경 모두 여기서 처리된다
	useEffect(() => {
		redraw();
	}, [redraw]);

	return (
		<canvas
			ref={canvasRef}
			width={MASK_W}
			height={MASK_H}
			aria-label="가릴 부위를 그리는 캔버스"
			className="h-full w-auto max-h-full max-w-full object-contain cursor-crosshair touch-none rounded-[12px] border border-black/10 bg-[#f4f4f5]"
			{...handlers}
		/>
	);
}
