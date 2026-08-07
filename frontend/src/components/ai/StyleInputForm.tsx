import { useCallback, useRef, useState } from "react";
import useBackClose from "../../hooks/useBackClose";
import { GENRE_TAGS, MAX_REFERENCE_IMAGES, type GenreTag } from "./constants";

type StyleInputFormProps = {
	selectedGenres: string[];
	prompt: string;
	referenceImages: string[];
	showHero?: boolean;
	canGenerate: boolean;
	generating?: boolean;
	generationError?: string | null;
	onToggleGenre: (id: string) => void;
	onPromptChange: (value: string) => void;
	onAddReferenceImages: (files: FileList) => void;
	onRemoveReferenceImage: (index: number) => void;
	onGenerate: () => void;
};

const TOOLTIP_WIDTH = 260;
const TOOLTIP_OFFSET = 16;

function clampTooltipPosition(clientX: number, clientY: number) {
	const maxX = window.innerWidth - TOOLTIP_WIDTH - 12;
	const x = Math.min(Math.max(clientX + TOOLTIP_OFFSET, 12), Math.max(maxX, 12));
	const y = Math.max(clientY + TOOLTIP_OFFSET, 12);
	return { x, y };
}

function InfoIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
			<circle cx="7" cy="7" r="6.25" stroke="currentColor" strokeWidth="1.5" />
			<path d="M7 6.2V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<circle cx="7" cy="4.2" r="0.9" fill="currentColor" />
		</svg>
	);
}

export default function StyleInputForm({
	selectedGenres,
	prompt,
	referenceImages,
	showHero = true,
	canGenerate,
	generating = false,
	generationError = null,
	onToggleGenre,
	onPromptChange,
	onAddReferenceImages,
	onRemoveReferenceImage,
	onGenerate,
}: StyleInputFormProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const [hoveredTag, setHoveredTag] = useState<GenreTag | null>(null);
	const [infoTag, setInfoTag] = useState<GenreTag | null>(null);

	const closeInfo = useCallback(() => setInfoTag(null), []);
	useBackClose(Boolean(infoTag), closeInfo);

	const moveTooltip = useCallback((clientX: number, clientY: number) => {
		const el = tooltipRef.current;
		if (!el) return;
		const { x, y } = clampTooltipPosition(clientX, clientY);
		el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
	}, []);

	const showTooltip = useCallback(
		(tag: GenreTag, clientX: number, clientY: number) => {
			moveTooltip(clientX, clientY);
			setHoveredTag(tag);
		},
		[moveTooltip],
	);

	const hideTooltip = useCallback(() => {
		setHoveredTag(null);
	}, []);

	return (
		<div className="px-8 py-10 max-lg:px-0 max-lg:pb-32 max-lg:pt-9">
			{showHero && (
				<div className="mx-auto mb-14 flex max-w-[720px] flex-col items-center text-center max-lg:hidden">
					<p className="text-[20px] leading-6 text-black">상상만 하던 타투, 이제 눈으로 확인해보세요</p>
					<h1 className="mt-3 text-[36px] font-extrabold leading-[43px] text-black">AI로 나만의 맞춤 타투 도안을 생성해보세요</h1>
				</div>
			)}

			<section className="mb-10 max-lg:mb-8">
				<div className="mb-4 max-lg:text-center">
					<h2 className="text-[20px] font-bold leading-6 text-black max-lg:text-[22px] max-lg:leading-7">
						타투 스타일 <span className="font-normal text-[#666] max-lg:font-bold max-lg:text-black">(장르 태그)</span>
					</h2>
				</div>

				{/* 모바일은 부모(px-0)에 흡수될 패딩이 없어 음수 마진을 쓰면 뷰포트를 넘친다 */}
				<div className="relative -mx-2 px-2 max-lg:mx-0 max-lg:px-0">
					<div className="genre-tag-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 py-2 pb-3 max-lg:gap-2 max-lg:scroll-pl-4 max-lg:px-4">
						{GENRE_TAGS.map((tag) => {
							// 스타일은 하나만 고른다. 다른 태그를 누르면 교체되므로 잠기는 칸이 없다.
							const isSelected = selectedGenres.includes(tag.id);

							return (
								<div key={tag.id} className="relative size-[140px] shrink-0 snap-start max-lg:size-[100px]">
									<button
										type="button"
										aria-pressed={isSelected}
										aria-describedby={hoveredTag?.id === tag.id ? "genre-tag-tooltip" : undefined}
										onClick={() => onToggleGenre(tag.id)}
										onMouseEnter={(event) => showTooltip(tag, event.clientX, event.clientY)}
										onMouseMove={(event) => {
											if (hoveredTag?.id !== tag.id) {
												showTooltip(tag, event.clientX, event.clientY);
												return;
											}
											moveTooltip(event.clientX, event.clientY);
										}}
										onMouseLeave={hideTooltip}
										className={`group relative size-full overflow-hidden rounded-[10px] border-[3px] transition hover:opacity-90 max-lg:rounded-lg max-lg:border-2 ${isSelected ? "border-brand" : "border-[#D7D7D7] lg:border-transparent"}`}
										style={{ backgroundColor: tag.bgColor }}>
										<img src={tag.image} alt={tag.label} className="size-full object-contain p-1.5 max-lg:p-1" />
										<div
											aria-hidden="true"
											className={`pointer-events-none absolute inset-0 flex items-end justify-center bg-black/50 pb-4 transition-opacity duration-200 max-lg:bg-transparent max-lg:bg-gradient-to-t max-lg:from-black/65 max-lg:to-transparent max-lg:pb-2 max-lg:opacity-100 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
											<span className="text-[18px] font-bold text-white max-lg:text-[14px]">{tag.label}</span>
										</div>
									</button>

									<button
										type="button"
										aria-label={`${tag.label} 스타일 설명 보기`}
										onClick={() => setInfoTag(tag)}
										className="absolute right-1.5 top-1.5 z-10 flex size-6 items-center justify-center text-black lg:hidden">
										<InfoIcon />
									</button>
								</div>
							);
						})}
					</div>
				</div>

				{/* 데스크톱: 마우스 근처 툴팁 */}
				<div
					ref={tooltipRef}
					id="genre-tag-tooltip"
					role="tooltip"
					aria-hidden={!hoveredTag}
					style={{ width: TOOLTIP_WIDTH }}
					className={`pointer-events-none fixed left-0 top-0 z-50 max-lg:hidden will-change-transform ${hoveredTag ? "opacity-100" : "opacity-0"}`}>
					<div className="rounded-[12px] border border-[#E5E5E5] bg-white px-3.5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
						{hoveredTag && (
							<>
								<p className="text-[14px] font-semibold leading-5 text-black">{hoveredTag.label}</p>
								<p className="mt-1 text-[13px] font-light leading-[18px] text-[#555]">{hoveredTag.description}</p>
							</>
						)}
					</div>
				</div>

				{/* 모바일: 설명 모달 */}
				{infoTag && (
					<div
						className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-6 lg:hidden"
						onClick={closeInfo}
						role="presentation">
						<div
							className="w-full max-w-[320px] rounded-[16px] bg-white px-5 pb-5 pt-6"
							onClick={(event) => event.stopPropagation()}
							role="dialog"
							aria-modal="true"
							aria-labelledby="genre-info-title">
							<p id="genre-info-title" className="text-center text-[18px] font-bold leading-6 text-black">
								{infoTag.label}
							</p>
							<p className="mt-3 text-center text-[14px] font-light leading-[20px] text-[#555]">
								{infoTag.description}
							</p>
							<button
								type="button"
								onClick={closeInfo}
								className="mt-5 flex h-11 w-full items-center justify-center rounded-[50px] bg-brand text-[16px] font-semibold text-white active:brightness-95">
								닫기
							</button>
						</div>
					</div>
				)}
			</section>

			<section className="mb-10 max-lg:mb-8 max-lg:px-4">
				<div className="mb-4 max-lg:text-center">
					<h2 className="text-[20px] font-bold leading-6 text-black max-lg:text-[22px] max-lg:leading-7">프롬프트</h2>
					<p className="mt-1 text-[16px] font-light leading-[19px] text-[#666] max-lg:mt-2 max-lg:text-[14px] max-lg:text-[#222]">키워드 위주로 작성해주세요</p>
				</div>
				<textarea
					value={prompt}
					onChange={(event) => onPromptChange(event.target.value)}
					placeholder="예) 개, 고양이"
					rows={5}
					className="w-full resize-none rounded-[10px] border border-[#D9D9D9] px-5 py-4 text-[16px] font-light leading-[22px] text-black outline-none transition placeholder:text-[#CFCFCF] focus:border-brand max-lg:h-[160px] max-lg:bg-white max-lg:px-4 max-lg:text-[14px]"
				/>
			</section>

			<section className="mb-12 max-lg:mb-0 max-lg:px-4 max-lg:text-center">
				<div className="mb-4">
					<h2 className="text-[20px] font-bold leading-6 text-black max-lg:text-[22px] max-lg:leading-7">참고용 도안 이미지</h2>
					<p className="mt-1 text-[16px] font-light leading-[19px] text-[#666] max-lg:mt-2 max-lg:text-[14px] max-lg:text-[#222]">이미지는 {MAX_REFERENCE_IMAGES}개만 등록할 수 있어요</p>
				</div>

				<div className="flex flex-wrap gap-4 max-lg:justify-center">
					{referenceImages.map((imageUrl, index) => (
						<div key={imageUrl} className="group relative size-[140px] overflow-hidden rounded-[10px] max-lg:size-[100px]">
							<img src={imageUrl} alt={`참고 이미지 ${index + 1}`} className="size-full object-cover" />
							<button type="button" onClick={() => onRemoveReferenceImage(index)} aria-label={`참고 이미지 ${index + 1} 삭제`} className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-sm text-white">×</button>
						</div>
					))}

					{referenceImages.length < MAX_REFERENCE_IMAGES && (
						<>
							<button type="button" onClick={() => fileInputRef.current?.click()} aria-label="참고 이미지 추가" className="flex size-[140px] items-center justify-center rounded-[10px] border border-[#D9D9D9] bg-[#FAFAFA] transition hover:bg-[#F0F0F0] max-lg:size-[100px] max-lg:bg-white">
								<span className="text-[48px] font-extralight leading-none text-[#CFCFCF] max-lg:text-[38px]">＋</span>
							</button>
							<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { if (event.target.files?.length) { onAddReferenceImages(event.target.files); event.target.value = ""; } }} />
						</>
					)}
				</div>
			</section>

			{generationError && <p className="mb-4 text-center text-[14px] text-red-500">{generationError}</p>}

			<div className="flex justify-center max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40">
				<button type="button" disabled={!canGenerate || generating} onClick={onGenerate} className={`inline-flex h-[52px] min-w-[220px] items-center justify-center rounded-[50px] px-6 text-[20px] font-semibold text-white transition max-lg:h-[60px] max-lg:w-full max-lg:rounded-b-none max-lg:rounded-t-[10px] max-lg:text-[20px] max-lg:font-bold ${canGenerate && !generating ? "bg-brand hover:brightness-95 active:scale-[0.99]" : "cursor-not-allowed bg-[#FFB4B4]"}`}>
					{generating ? "도안 생성 중..." : "도안 생성하기"}
				</button>
			</div>
		</div>
	);
}
