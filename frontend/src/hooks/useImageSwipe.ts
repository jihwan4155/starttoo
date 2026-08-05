import { useRef, useState } from "react";
import type {
	CSSProperties,
	MouseEvent as ReactMouseEvent,
	PointerEvent as ReactPointerEvent,
} from "react";

// 이 거리를 넘겨야 클릭이 아니라 드래그로 본다
const DRAG_START = 8;
// 이 거리를 넘겨야 다음/이전 장으로 넘어간다 (칸 너비의 20%, 최대 80px)
const SWIPE_RATIO = 0.2;
const SWIPE_MAX = 80;

type Options = {
	count: number;
	index: number;
	onIndexChange: (index: number) => void;
	enabled?: boolean;
};

/**
 * 이미지 캐러셀을 드래그·스와이프로 넘긴다.
 * 반환한 handlers를 이미지 칸에, trackStyle을 이미지들을 감싼 flex 트랙에 준다.
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
	const drag = useRef({ startX: 0, width: 1, active: false, moved: false });

	const active = enabled && count > 1;

	const end = (event: ReactPointerEvent<HTMLElement>) => {
		if (!drag.current.active) return;
		drag.current.active = false;
		setDragging(false);
		if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}

		const moved = event.clientX - drag.current.startX;
		setDragX(0);
		const threshold = Math.min(drag.current.width * SWIPE_RATIO, SWIPE_MAX);
		if (moved <= -threshold) onIndexChange(Math.min(count - 1, index + 1));
		else if (moved >= threshold) onIndexChange(Math.max(0, index - 1));
	};

	const handlers = {
		onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
			// 드래그 여부와 무관하게 매 입력마다 초기화해 둔다
			drag.current.moved = false;
			if (!active) return;
			if (event.pointerType === "mouse" && event.button !== 0) return;
			drag.current = {
				startX: event.clientX,
				width: event.currentTarget.clientWidth || 1,
				active: true,
				moved: false,
			};
			setDragging(true);
		},
		onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
			if (!drag.current.active) return;
			const moved = event.clientX - drag.current.startX;
			if (!drag.current.moved) {
				if (Math.abs(moved) < DRAG_START) return;
				drag.current.moved = true;
				event.currentTarget.setPointerCapture?.(event.pointerId);
			}
			// 첫 장·마지막 장 바깥으로는 덜 끌려오게 저항을 준다
			const atEdge =
				(moved > 0 && index === 0) || (moved < 0 && index === count - 1);
			setDragX(atEdge ? moved / 3 : moved);
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
