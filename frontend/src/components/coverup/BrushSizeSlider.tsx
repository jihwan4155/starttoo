import { BRUSH_MAX, BRUSH_MIN, BRUSH_STEP } from "./shapeSearchConstants";

type BrushSizeSliderProps = {
	value: number;
	onChange: (px: number) => void;
};

/**
 * 펜 굵기 조절 — 캔버스 위 자리(예전 모드 토글 자리)에 둔다.
 *
 * <p>PC와 모바일이 같은 markup을 쓰도록 컴포넌트로 뺐다. 옆 점은 실제 굵기를
 * 그대로 보여줘서 그려 보기 전에 굵기를 가늠할 수 있게 한다.
 */
export default function BrushSizeSlider({
	value,
	onChange,
}: BrushSizeSliderProps) {
	return (
		<div className="mx-auto flex h-[40px] w-full max-w-[280px] shrink-0 items-center gap-3 rounded-[12px] bg-white px-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
			<label
				htmlFor="coverup-brush-size"
				className="shrink-0 text-[13px] font-semibold text-black/60">
				펜 굵기
			</label>
			<input
				id="coverup-brush-size"
				type="range"
				min={BRUSH_MIN}
				max={BRUSH_MAX}
				step={BRUSH_STEP}
				value={value}
				onChange={(event) => onChange(Number(event.target.value))}
				aria-valuetext={`${value}픽셀`}
				className="h-1 min-w-0 flex-1 cursor-pointer accent-brand"
			/>
			{/* 굵기 미리보기 — 슬라이더 값과 같은 지름의 점 */}
			<span
				aria-hidden
				className="shrink-0 rounded-full bg-brand"
				style={{ width: value, height: value }}
			/>
		</div>
	);
}
