type ResultSectionProps = {
	generatedImages: string[];
	selectedIndices: number[];
	onToggleSelect: (index: number) => void;
	onZoom: (imageUrl: string) => void;
	onGenerateMore: () => void;
	onSave: () => void;
	saving?: boolean;
	saveError?: string | null;
};

function ZoomIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
			<circle cx="8.5" cy="8.5" r="5.5" stroke="white" strokeWidth="2" />
			<path d="M13 13l4 4" stroke="white" strokeWidth="2" strokeLinecap="round" />
			<path
				d="M6.5 8.5h4M8.5 6.5v4"
				stroke="white"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export default function ResultSection({
	generatedImages,
	selectedIndices,
	onToggleSelect,
	onZoom,
	onGenerateMore,
	onSave,
	saving = false,
	saveError = null,
}: ResultSectionProps) {
	return (
		<div className="px-8 py-10">
			<p className="mb-10 text-center text-[20px] font-normal leading-6 text-black">
				도안이 마음에 든다면 저장해보세요
			</p>

			<div className="mx-auto grid max-w-[900px] grid-cols-3 gap-4">
				{generatedImages.map((imageUrl, index) => {
					const isSelected = selectedIndices.includes(index);

					return (
						<div
							key={`${imageUrl}-${index}`}
							className={`relative aspect-square overflow-hidden rounded-[10px] border-[3px] transition ${
								isSelected ? "border-brand" : "border-transparent"
							}`}>
							<button
								type="button"
								onClick={() => onToggleSelect(index)}
								className="block size-full">
								<img
									src={imageUrl}
									alt={`생성된 도안 ${index + 1}`}
									className="size-full object-cover transition hover:brightness-95"
								/>
							</button>

							<button
								type="button"
								aria-label={`생성된 도안 ${index + 1} 확대 보기`}
								onClick={(event) => {
									event.stopPropagation();
									onZoom(imageUrl);
								}}
								className="absolute bottom-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/50 transition hover:bg-black/70">
								<ZoomIcon />
							</button>
						</div>
					);
				})}
			</div>

			<div className="mt-12 flex flex-wrap items-center justify-center gap-4">
				<button
					type="button"
					onClick={onGenerateMore}
					className="inline-flex h-[52px] min-w-[280px] items-center justify-center rounded-[50px] border border-black bg-white px-6 text-[18px] font-semibold text-black transition hover:bg-gray-50">
					+ 같은 조건으로 도안 추가 생성
				</button>
				<button
					type="button"
					onClick={onSave}
					disabled={saving || selectedIndices.length === 0}
					className="inline-flex h-[52px] min-w-[180px] items-center justify-center rounded-[50px] bg-brand px-6 text-[18px] font-semibold text-white transition hover:brightness-95 disabled:opacity-50">
					{saving ? "저장 중…" : "도안 저장하기"}
				</button>
			</div>

			{saveError && (
				<p className="mt-4 text-center text-[14px] text-red-500">
					{saveError}
				</p>
			)}
		</div>
	);
}
