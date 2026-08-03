import { useRef } from "react";
import {
	GENRE_TAGS,
	MAX_GENRE_SELECTION,
	MAX_REFERENCE_IMAGES,
} from "./constants";

type StyleInputFormProps = {
	selectedGenres: string[];
	prompt: string;
	referenceImages: string[];
	showHero?: boolean;
	canGenerate: boolean;
	onToggleGenre: (id: string) => void;
	onPromptChange: (value: string) => void;
	onAddReferenceImages: (files: FileList) => void;
	onRemoveReferenceImage: (index: number) => void;
	onGenerate: () => void;
};

export default function StyleInputForm({
	selectedGenres,
	prompt,
	referenceImages,
	showHero = true,
	canGenerate,
	onToggleGenre,
	onPromptChange,
	onAddReferenceImages,
	onRemoveReferenceImage,
	onGenerate,
}: StyleInputFormProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);

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
					<p className="mt-1 text-[16px] font-light leading-[19px] text-[#666] max-lg:mt-2 max-lg:text-[14px] max-lg:text-[#222]">
						최대 {MAX_GENRE_SELECTION}개까지 선택 가능합니다
					</p>
				</div>

				<div className="relative -mx-2 px-2 max-lg:-mx-4 max-lg:px-0">
					<div className="genre-tag-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 py-2 pb-3 max-lg:gap-2 max-lg:px-4">
						{GENRE_TAGS.map((tag) => {
							const isSelected = selectedGenres.includes(tag.id);
							const isDisabled = !isSelected && selectedGenres.length >= MAX_GENRE_SELECTION;

							return (
								<button
									key={tag.id}
									type="button"
									disabled={isDisabled}
									onClick={() => onToggleGenre(tag.id)}
									className={`relative size-[140px] shrink-0 snap-start overflow-hidden rounded-[10px] border-[3px] transition max-lg:size-[100px] max-lg:rounded-lg max-lg:border-2 ${isSelected ? "border-brand" : "border-[#D7D7D7] lg:border-transparent"} ${isDisabled ? "opacity-40" : "hover:opacity-90"}`}>
									<img src={tag.image} alt={tag.label} className="size-full object-cover" />
									{isSelected && (
										<div className="absolute inset-0 flex items-end justify-center bg-black/50 pb-4">
											<span className="text-[18px] font-bold text-white max-lg:text-[14px]">{tag.label}</span>
										</div>
									)}
								</button>
							);
						})}
					</div>
				</div>
			</section>

			<section className="mb-10 max-lg:mb-8 max-lg:px-4">
				<div className="mb-4 max-lg:text-center">
					<h2 className="text-[20px] font-bold leading-6 text-black max-lg:text-[22px] max-lg:leading-7">프롬프트</h2>
					<p className="mt-1 text-[16px] font-light leading-[19px] text-[#666] max-lg:mt-2 max-lg:text-[14px] max-lg:text-[#222]">추가 스타일이나 원하는 도안을 작성해주세요</p>
				</div>
				<textarea
					value={prompt}
					onChange={(event) => onPromptChange(event.target.value)}
					placeholder="이곳에 작성해주세요"
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

			<div className="flex justify-center max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40">
				<button type="button" disabled={!canGenerate} onClick={onGenerate} className={`inline-flex h-[52px] min-w-[220px] items-center justify-center rounded-[50px] px-6 text-[20px] font-semibold text-white transition max-lg:h-[60px] max-lg:w-full max-lg:rounded-b-none max-lg:rounded-t-[10px] max-lg:text-[20px] max-lg:font-bold ${canGenerate ? "bg-brand hover:brightness-95 active:scale-[0.99]" : "cursor-not-allowed bg-[#FFB4B4]"}`}>
					도안 생성하기
				</button>
			</div>
		</div>
	);
}
