type ResultSectionProps = {
	generatedImages: string[];
	selectedIndices: number[];
	onToggleSelect: (index: number) => void;
	onZoom: (imageUrl: string) => void;
	onGenerateMore: () => void;
	onSave: () => void;
	saving?: boolean;
	saveError?: string | null;
	onMobileBack?: () => void;
};

function BackIcon() {
	return <svg width="20" height="24" viewBox="0 0 20 24" fill="none" aria-hidden><path d="m15 3-9 9 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ZoomIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
			<circle cx="8.5" cy="8.5" r="5.5" stroke="white" strokeWidth="2" />
			<path d="M13 13l4 4" stroke="white" strokeWidth="2" strokeLinecap="round" />
			<path d="M6.5 8.5h4M8.5 6.5v4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
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
	onMobileBack,
}: ResultSectionProps) {
	return (
		<div className="px-8 py-10 max-lg:px-4 max-lg:pb-28 max-lg:pt-8">
			<div className="mb-10 text-center max-lg:mb-4">
				<div className="relative hidden min-h-8 items-center justify-center max-lg:flex">
					{onMobileBack && <button type="button" onClick={onMobileBack} aria-label="이전 단계" className="absolute left-0 flex size-8 items-center justify-center text-[#BDBDBD]"><BackIcon /></button>}
					<h2 className="px-9 text-[22px] font-bold leading-7">생성 결과 도안</h2>
				</div>
				<p className="text-[20px] leading-6 text-black max-lg:mt-2 max-lg:text-[14px] max-lg:leading-5">중복 선택하여 저장이 가능합니다</p>
				<span className="mt-3 hidden rounded-full bg-brand px-4 py-1 text-[18px] leading-6 text-white max-lg:inline-block">{selectedIndices.length}/20</span>
			</div>

			<div className="mx-auto grid max-w-[900px] grid-cols-3 gap-4 max-lg:grid-cols-2 max-lg:gap-6">
				{generatedImages.map((imageUrl, index) => {
					const isSelected = selectedIndices.includes(index);
					return (
						<div key={`${imageUrl}-${index}`} className={`relative aspect-square overflow-hidden rounded-[10px] transition ${isSelected ? "border-4 border-brand" : "border-[3px] border-transparent max-lg:border-2 max-lg:border-[#D7D7D7]"}`}>
							<button type="button" onClick={() => onToggleSelect(index)} className="block size-full">
								<img src={imageUrl} alt={`생성된 도안 ${index + 1}`} className="size-full object-cover transition hover:brightness-95" />
							</button>
							<button type="button" aria-label={`생성된 도안 ${index + 1} 확대 보기`} onClick={(event) => { event.stopPropagation(); onZoom(imageUrl); }} className="absolute bottom-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/55 transition hover:bg-black/70 max-lg:bottom-2 max-lg:right-2 max-lg:size-7">
								<ZoomIcon />
							</button>
						</div>
					);
				})}
			</div>

			<div className="mt-12 flex flex-wrap items-center justify-center gap-4 max-lg:mt-6">
				<button type="button" onClick={onGenerateMore} className="inline-flex h-[52px] min-w-[280px] items-center justify-center rounded-[50px] border border-black bg-white px-6 text-[18px] font-semibold text-black transition hover:bg-gray-50 max-lg:h-12 max-lg:w-[76%] max-lg:min-w-0 max-lg:text-[16px] max-lg:font-normal">+ 도안 추가 생성</button>
				<button type="button" onClick={onSave} disabled={saving || selectedIndices.length === 0} className="inline-flex h-[52px] min-w-[180px] items-center justify-center rounded-[50px] bg-brand px-6 text-[18px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#D9D9D9] disabled:text-[#666666] disabled:hover:brightness-100 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:h-[60px] max-lg:w-full max-lg:rounded-b-none max-lg:rounded-t-[10px] max-lg:text-[20px] max-lg:font-bold">
					{saving ? "저장 중" : "도안 저장하기"}
				</button>
			</div>

			{saveError && <p className="mt-4 text-center text-[14px] text-red-500">{saveError}</p>}
		</div>
	);
}
