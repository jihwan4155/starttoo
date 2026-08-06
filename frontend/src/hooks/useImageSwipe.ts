import { useRef, useState } from "react";
import type {
	CSSProperties,
	MouseEvent as ReactMouseEvent,
	PointerEvent as ReactPointerEvent,
} from "react";

// 이 거리를 넘겨야 클릭이 아니라 드래그로 본다
const DRAG_START = 8;
// 가로가 세로보다 이 배수 이상 움직여야 장을 넘기는 드래그로 본다.
// 세로로 스크롤하다 손가락이 옆으로 조금 밀려도 사진이 넘어가지 않게 하는 값
const AXIS_RATIO = 1.2;
// 이 거리를 넘겨야 다음/이전 장으로 넘어간다 (칸 너비의 20%, 최대 80px)
const SWIPE_RATIO = 0.2;
const SWIPE_MAX = 80;

// 입력이 가로 드래그인지 세로 스크롤인지 판정한 결과
type Axis = "none" | "x" | "y";

type Options = {
	count: number;
	index: number;
	onIndexChange: (index: number) => void;
	enabled?: boolean;
};

/**
 * 이미지 캐러셀을 드래그·스와이프로 넘긴다.
 * 반환한 handlers를 이미지 칸에, trackStyle을 이미지들을 감싼 flex 트랙에 준다.
 *
 * 처음 움직인 방향으로 축을 잠근다. 세로로 잠기면 그 입력은 캐러셀이 손대지 않아
 * 손가락 스크롤 중에 사진이 멋대로 넘어가지 않는다.
 */
export default function useImageSwipe({
	count,
	index,
	onIndexChange,
	enabled = true,
}: Options) {
	const [dragX, setDragX] = useState(0);
	const [isDragging, setDragging] = useState(false);
	// 드래그 중 상태는 리렌더가 필요 없어 ref로 둔다
	const drag = useRef({
		startX: 0,
		startY: 0,
		width: 1,
		active: false,
		moved: false,
		axis: "none" as Axis,
	});

	const active = enabled && count > 1;

	// 세로 스크롤로 판정된 입력은 브라우저에 그대로 넘긴다
	const giveUp = () => {
		drag.current.active = false;
		drag.current.axis = "y";
		// 이미 8px을 넘겼으니 탭이 아니다 — 이어지는 클릭은 막는다
		drag.current.moved = true;
		setDragging(false);
		setDragX(0);
	};

	const end = (event: ReactPointerEvent<HTMLElement>) => {
		if (!drag.current.active) return;
		drag.current.active = false;
		setDragging(false);
		if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}

		const moved = event.clientX - drag.current.startX;
		setDragX(0);
		// 가로로 잠히지 않은 입력은 장을 넘기지 않는다
		if (drag.current.axis !== "x") return;
		const threshold = Math.min(drag.current.width * SWIPE_RATIO, SWIPE_MAX);
		if (moved <= -threshold) onIndexChange(Math.min(count - 1, index + 1));
		else if (moved >= threshold) onIndexChange(Math.max(0, index - 1));
	};

	const handlers = {
		onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
			// 드래그 여부와 무관하게 매 입력마다 초기화해 둔다
			drag.current.moved = false;
			drag.current.axis = "none";
			if (!active) return;
			if (event.pointerType === "mouse" && event.button !== 0) return;
			drag.current = {
				startX: event.clientX,
				startY: event.clientY,
				width: event.currentTarget.clientWidth || 1,
				active: true,
				moved: false,
				axis: "none",
			};
			setDragging(true);
		},
		onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
			if (!drag.current.active) return;
			const movedX = event.clientX - drag.current.startX;
			if (drag.current.axis === "none") {
				const movedY = event.clientY - drag.current.startY;
				// 어느 쪽으로든 충분히 움직이기 전에는 축을 정하지 않는다
				if (Math.max(Math.abs(movedX), Math.abs(movedY)) < DRAG_START) return;
				if (Math.abs(movedX) < Math.abs(movedY) * AXIS_RATIO) {
					giveUp();
					return;
				}
				drag.current.axis = "x";
				drag.current.moved = true;
				event.currentTarget.setPointerCapture?.(event.pointerId);
			}
			// 첫 장·마지막 장 바깥으로는 덜 끌려오게 저항을 준다
			const atEdge =
				(movedX > 0 && index === 0) || (movedX < 0 && index === count - 1);
			setDragX(atEdge ? movedX / 3 : movedX);
		},
		onPointerUp: end,
		onPointerCancel: end,
		// 드래그로 끝난 입력은 클릭(상세 열기)으로 이어지지 않게 막는다
		onClickCapture: (event: ReactMouseEvent<HTMLElement>) => {
			if (!drag.current.moved) return;
			event.preventDefault();
			event.stopPropagation();
		},
		// 가로는 우리가 처리하고 세로 스크롤은 브라우저에 맡긴다
		style: { touchAction: "pan-y" } as CSSProperties,
	};

	const trackStyle: CSSProperties = {
		transform: `translate3d(calc(${-index * 100}% + ${dragX}px), 0, 0)`,
		transition: isDragging
			? "none"
			: "transform 300ms cubic-bezier(0.22, 0.61, 0.36, 1)",
	};

	return { handlers, trackStyle, isDragging };
}
