import { useRef } from "react";
import type { PointerEvent } from "react";
import type { CoverupSelection } from "../../types/coverup";

type RegionSelectorProps = {
	src: string;
	selection: CoverupSelection | null;
	onChange?: (selection: CoverupSelection) => void;
	/** true면 드래그로 원형 영역을 선택할 수 있음 */
	selectable?: boolean;
};

export default function RegionSelector({
	src,
	selection,
	onChange,
	selectable = false,
}: RegionSelectorProps) {
	const boxRef = useRef<HTMLDivElement>(null);
	// 드래그 상태는 리렌더와 무관하게 즉시 반영돼야 하므로 state 대신 ref 사용
	const startRef = useRef<{ x: number; y: number } | null>(null);

	const toNormalized = (e: PointerEvent<HTMLDivElement>) => {
		const rect = boxRef.current!.getBoundingClientRect();
		return {
			x: (e.clientX - rect.left) / rect.width,
			y: (e.clientY - rect.top) / rect.height,
		};
	};

	const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
		if (!selectable || !onChange) return;
		e.currentTarget.setPointerCapture(e.pointerId);
		const point = toNormalized(e);
		startRef.current = point;
		onChange({ x: point.x, y: point.y, radius: 0.02 });
	};

	const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
		if (!startRef.current || !onChange) return;
		const rect = boxRef.current!.getBoundingClientRect();
		const start = startRef.current;
		const point = toNormalized(e);
		// 반지름은 이미지 너비 기준으로 통일 (y 거리는 종횡비 보정)
		const dx = point.x - start.x;
		const dy = (point.y - start.y) * (rect.height / rect.width);
		const radius = Math.max(Math.sqrt(dx * dx + dy * dy), 0.02);
		onChange({ x: start.x, y: start.y, radius });
	};

	const handlePointerUp = () => {
		startRef.current = null;
	};

	return (
		<div
			ref={boxRef}
			role="presentation"
			className={`relative w-full overflow-hidden rounded-[10px] bg-[#d9d9d9] ${
				selectable ? "cursor-crosshair touch-none" : ""
			}`}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}>
			<img
				src={src}
				alt="업로드한 부위 사진"
				draggable={false}
				className="h-[clamp(240px,45vh,400px)] w-full select-none object-contain"
			/>
			{selection && (
				<div
					className="pointer-events-none absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(0,0,0,0.35)]"
					style={{
						left: `${selection.x * 100}%`,
						top: `${selection.y * 100}%`,
						width: `${selection.radius * 2 * 100}%`,
					}}
				/>
			)}
		</div>
	);
}
