import type { DesignResult } from "../../types/shapeSearch";

type ResultsGridProps = {
	results: DesignResult[];
	selectedIndex: number;
	onSelect: (index: number) => void;
	onZoom: (index: number) => void;
	/** presigned URL 만료로 이미지가 깨졌는지 */
	isStale: boolean;
	onStale: () => void;
	onRefresh: () => void;
	isRefreshing: boolean;
};

function ZoomIcon() {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round">
			<circle cx="11" cy="11" r="7" />
			<path d="m21 21-4.3-4.3" />
		</svg>
	);
}

/**
 * 추천 도안 그리드.
 *
 * <p>서버가 점수 내림차순으로 주므로 여기서 다시 정렬하지 않는다. 삭제된 도안이
 * 빠지면 개수가 요청보다 적을 수 있어 장수를 고정하지 않는다.
 *
 * <p>부모가 준 높이 안에 4×2로 담는다. 카드 높이를 px로 박지 않고 그리드 행을
 * 균등 분할해, 세로가 짧은 화면에서도 스크롤 없이 전부 보이게 한다.
 */
export default function ResultsGrid({
	results,
	selectedIndex,
	onSelect,
	onZoom,
	isStale,
	onStale,
	onRefresh,
	isRefreshing,
}: ResultsGridProps) {
	return (
		<div className="flex h-full w-full flex-col">
			{/* imageUrl은 1시간 만료라 결과를 오래 열어두면 깨진다. 전체 재검색을
			    자동으로 돌리지 않고 유저가 새로고침하도록 안내한다 */}
			{isStale && (
				<div className="mb-2 flex shrink-0 flex-wrap items-center justify-center gap-3 rounded-[10px] border border-brand/30 bg-brand/5 px-4 py-2">
					<p className="text-[13px] font-light text-black/70">
						이미지 주소가 만료됐어요. 결과를 새로 불러와주세요.
					</p>
					<button
						type="button"
						onClick={onRefresh}
						disabled={isRefreshing}
						className="rounded-full bg-brand px-4 py-1 text-[13px] font-semibold text-white transition disabled:opacity-50">
						{isRefreshing ? "불러오는 중…" : "결과 새로고침"}
					</button>
				</div>
			)}

			<div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-3">
				{results.map((result, index) => (
					<div key={result.tattooSeq} className="relative min-h-0">
						<button
							type="button"
							aria-label={`도안 ${index + 1} 선택`}
							onClick={() => onSelect(index)}
							className={`flex h-full w-full flex-col overflow-hidden rounded-[12px] border bg-white transition ${
								index === selectedIndex
									? "border-brand ring-2 ring-brand"
									: "border-black/10 hover:border-black/25"
							}`}>
							<img
								src={result.imageUrl}
								alt={`추천 도안 ${index + 1}`}
								loading="lazy"
								onError={onStale}
								className="min-h-0 w-full flex-1 object-contain"
							/>
							{/* styleCode는 슬러그라 표시하지 않는다. 미분류 도안은 라벨이 없다 */}
							<p className="shrink-0 truncate px-2 py-1 text-[12px] font-light text-black/50">
								{result.styleName ?? "미분류"}
							</p>
						</button>
						{index === selectedIndex && (
							<button
								type="button"
								aria-label="도안 크게 보기"
								onClick={() => onZoom(index)}
								className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-black shadow transition hover:bg-white">
								<ZoomIcon />
							</button>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
