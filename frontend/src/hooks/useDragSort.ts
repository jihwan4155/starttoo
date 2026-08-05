import { useEffect, useRef, useState } from "react";
import type {
	CSSProperties,
	MouseEvent as ReactMouseEvent,
	PointerEvent as ReactPointerEvent,
} from "react";

// 마우스는 이만큼 움직이면 바로 드래그로 본다
const MOUSE_SLOP = 6;
// 터치는 길게 눌러야 드래그 — 그 전에 움직이면 평소대로 스크롤된다
const TOUCH_HOLD_MS = 220;
const TOUCH_SLOP = 8;

type DragState = {
	pointerId: number;
	el: HTMLElement;
	startX: number;
	startY: number;
	/** 잡은 지점이 타일 안에서 어디였는지 */
	grabX: number;
	grabY: number;
	/** 드래그 시작 시점의 칸 위치들 (드래그 중에는 고정) */
	slots: DOMRect[];
	index: number;
	holdTimer: number | null;
	dragging: boolean;
};

type Options = {
	onReorder: (from: number, to: number) => void;
	enabled?: boolean;
};

/**
 * 그리드 타일을 끌어서 순서를 바꾼다.
 * 컨테이너에 data-sort-container, 각 타일에 getItemProps(index)를 준다.
 */
export default function useDragSort({ onReorder, enabled = true }: Options) {
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [offset, setOffset] = useState({ x: 0, y: 0 });
	const drag = useRef<DragState | null>(null);
	// 방금 끝난 입력이 드래그였는지 (클릭으로 이어지는 걸 막는 용도)
	const dragged = useRef(false);

	// 드래그 중에는 화면이 따라 스크롤되지 않게 막는다 (칸 위치 기준이 흔들리므로)
	useEffect(() => {
		if (dragIndex === null) return;
		const block = (event: TouchEvent) => event.preventDefault();
		document.addEventListener("touchmove", block, { passive: false });
		return () => document.removeEventListener("touchmove", block);
	}, [dragIndex]);

	const clearHold = () => {
		if (drag.current?.holdTimer) {
			window.clearTimeout(drag.current.holdTimer);
			drag.current.holdTimer = null;
		}
	};

	const begin = (state: DragState) => {
		const container = state.el.closest("[data-sort-container]");
		if (!container) return;
		state.slots = [...container.querySelectorAll("[data-sort-item]")].map(
			(node) => node.getBoundingClientRect(),
		);
		const slot = state.slots[state.index];
		if (!slot) return;
		state.grabX = state.startX - slot.left;
		state.grabY = state.startY - slot.top;
		state.dragging = true;
		dragged.current = true;
		state.el.setPointerCapture?.(state.pointerId);
		setDragIndex(state.index);
		setOffset({ x: 0, y: 0 });
	};

	const moveTo = (state: DragState, clientX: number, clientY: number) => {
		const slot = state.slots[state.index];
		if (!slot) return;
		setOffset({
			x: clientX - state.grabX - slot.left,
			y: clientY - state.grabY - slot.top,
		});
	};

	const finish = () => {
		clearHold();
		drag.current = null;
		setDragIndex(null);
		setOffset({ x: 0, y: 0 });
	};

	const getItemProps = (index: number) => ({
		"data-sort-item": "",
		onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
			dragged.current = false;
			if (!enabled) return;
			if (event.pointerType === "mouse" && event.button !== 0) return;
			// 삭제 버튼 같은 컨트롤 위에서는 드래그를 시작하지 않는다
			if ((event.target as HTMLElement).closest("button")) return;

			const el = event.currentTarget;
			const state: DragState = {
				pointerId: event.pointerId,
				el,
				startX: event.clientX,
				startY: event.clientY,
				grabX: 0,
				grabY: 0,
				slots: [],
				index,
				holdTimer: null,
				dragging: false,
			};
			drag.current = state;

			if (event.pointerType !== "mouse") {
				state.holdTimer = window.setTimeout(() => {
					state.holdTimer = null;
					if (drag.current === state) begin(state);
				}, TOUCH_HOLD_MS);
			}
		},
		onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
			const state = drag.current;
			if (!state) return;
			const dx = event.clientX - state.startX;
			const dy = event.clientY - state.startY;

			if (!state.dragging) {
				const moved = Math.hypot(dx, dy);
				if (event.pointerType === "mouse") {
					if (moved < MOUSE_SLOP) return;
					begin(state);
				} else {
					// 길게 누르기 전에 움직였으면 스크롤 의도로 보고 취소
					if (moved > TOUCH_SLOP) finish();
					return;
				}
			}

			moveTo(state, event.clientX, event.clientY);

			// 포인터가 올라간 칸으로 즉시 자리를 바꾼다
			const target = state.slots.findIndex(
				(rect) =>
					event.clientX >= rect.left &&
					event.clientX <= rect.right &&
					event.clientY >= rect.top &&
					event.clientY <= rect.bottom,
			);
			if (target !== -1 && target !== state.index) {
				onReorder(state.index, target);
				state.index = target;
				setDragIndex(target);
				moveTo(state, event.clientX, event.clientY);
			}
		},
		onPointerUp: finish,
		onPointerCancel: finish,
		// 드래그로 끝난 입력은 클릭으로 이어지지 않게 막는다
		onClickCapture: (event: ReactMouseEvent<HTMLElement>) => {
			if (!dragged.current) return;
			event.preventDefault();
			event.stopPropagation();
		},
		style: {
			touchAction: "pan-y",
			...(dragIndex === index
				? {
						transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(1.05)`,
						zIndex: 30,
						cursor: "grabbing",
					}
				: null),
		} as CSSProperties,
	});

	return { getItemProps, dragIndex };
}
