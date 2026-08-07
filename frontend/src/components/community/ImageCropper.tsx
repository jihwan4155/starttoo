import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { clampCrop, DEFAULT_CROP, previewScale } from "../../utils/image";
import type { CropState } from "../../utils/image";

const MAX_ZOOM = 3;
/**
 * 1이면 사진이 프레임을 꽉 채워(cover) 넘치는 부분이 잘린다. 1보다 작게 두면
 * 사진 전체가 들어오는 대신 남는 자리가 흰 여백이 된다 — 잘려 나가는 게 싫을 때 쓴다.
 */
const MIN_ZOOM = 0.5;

type ImageCropperProps = {
	src: string;
	crop: CropState;
	onChange: (next: CropState) => void;
	/** 크롭 뷰포트 비율 (가로/세로) — 기본 정사각형 */
	aspect?: number;
};

/**
 * 이미지 크롭 — 드래그로 영역 이동, 슬라이더로 확대/축소
 * 크롭 결과는 cropImageToDataUrl로 원본 파일에 적용된다.
 */
export default function ImageCropper({
	src,
	crop,
	onChange,
	aspect = 1,
}: ImageCropperProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<{
		startX: number;
		startY: number;
		baseX: number;
		baseY: number;
	} | null>(null);
	const [natural, setNatural] = useState<{ w: number; h: number } | null>(
		null,
	);
	const [viewport, setViewport] = useState(0);
	const [isDragging, setDragging] = useState(false);

	// 뷰포트 컨테이너의 실제 가로 픽셀 크기 추적
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const observer = new ResizeObserver(() => setViewport(el.clientWidth));
		observer.observe(el);
		setViewport(el.clientWidth);
		return () => observer.disconnect();
	}, []);

	const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
		// 포인터가 뷰포트를 벗어나도 드래그가 이어지도록 캡처 (실패해도 드래그는 동작)
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {
			/* no-op */
		}
		dragRef.current = {
			startX: e.clientX,
			startY: e.clientY,
			baseX: crop.offsetX,
			baseY: crop.offsetY,
		};
		setDragging(true);
	};

	const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || !natural || !viewport) return;
		onChange(
			clampCrop(
				{
					...crop,
					offsetX: drag.baseX + (e.clientX - drag.startX) / viewport,
					offsetY: drag.baseY + (e.clientY - drag.startY) / viewport,
				},
				natural.w,
				natural.h,
				aspect,
			),
		);
	};

	const handlePointerUp = () => {
		dragRef.current = null;
		setDragging(false);
	};

	const handleZoom = (zoom: number) => {
		if (!natural) return;
		onChange(clampCrop({ ...crop, zoom }, natural.w, natural.h, aspect));
	};

	// 뷰포트를 꽉 채우는 cover 배율 × zoom
	const scale = natural
		? viewport * previewScale(natural.w, natural.h, crop.zoom, aspect)
		: 0;

	return (
		<div>
			<div
				ref={containerRef}
				role="presentation"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
				style={{ aspectRatio: aspect }}
				className={`relative w-full touch-none select-none overflow-hidden rounded-[10px] bg-white ${
					isDragging ? "cursor-grabbing" : "cursor-grab"
				}`}>
				<img
					src={src}
					alt="크롭할 사진"
					draggable={false}
					onLoad={(e) =>
						setNatural({
							w: e.currentTarget.naturalWidth,
							h: e.currentTarget.naturalHeight,
						})
					}
					style={
						natural && viewport
							? {
									width: natural.w * scale,
									height: natural.h * scale,
									maxWidth: "none",
									transform: `translate(calc(-50% + ${
										crop.offsetX * viewport
									}px), calc(-50% + ${crop.offsetY * viewport}px))`,
								}
							: { opacity: 0 }
					}
					className="absolute left-1/2 top-1/2"
				/>
				{/* 3×3 격자 가이드 */}
				<div className="pointer-events-none absolute inset-0">
					<span className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
					<span className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
					<span className="absolute left-0 top-1/3 h-px w-full bg-white/40" />
					<span className="absolute left-0 top-2/3 h-px w-full bg-white/40" />
				</div>
			</div>

			{/* 확대/축소 + 초기화 */}
			<div className="mt-4 flex items-center gap-3">
				<input
					type="range"
					min={MIN_ZOOM}
					max={MAX_ZOOM}
					step={0.01}
					value={crop.zoom}
					onChange={(e) => handleZoom(Number(e.target.value))}
					aria-label="확대/축소"
					className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-black/15 accent-brand"
				/>
				<span className="w-10 text-right text-[12px] font-light text-black/40">
					{crop.zoom.toFixed(1)}x
				</span>
				<button
					type="button"
					onClick={() => onChange({ ...DEFAULT_CROP })}
					className="rounded-full border border-black/15 px-3 py-1 text-[12px] font-light text-black/60 transition hover:border-black/40 hover:text-black">
					초기화
				</button>
			</div>
			<p className="mt-2 text-center text-[12px] font-light text-black/40">
				드래그해서 위치를 옮기고, 슬라이더로 확대해 영역을 조절하세요.
			</p>
		</div>
	);
}
