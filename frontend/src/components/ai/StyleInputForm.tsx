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
		<div className="px-8 py-10">
			{showHero && (
				<div className="mx-auto mb-14 flex max-w-[720px] flex-col items-center text-center">
					<p className="text-[20px] font-normal leading-6 text-black">
						상상만 하던 타투, 이제 눈으로 확인해보세요
					</p>
					<h1 className="mt-3 text-[36px] font-extrabold leading-[43px] text-black">
						AI로 나만의 맞춤 타투 도안을 생성해보세요
					</h1>
				</div>
			)}

			<section className="mb-10">
				<div className="mb-4">
					<h2 className="text-[20px] font-bold leading-6 text-black">
						타투 스타일{" "}
						<span className="font-normal text-[#666]">(장르 태그)</span>
					</h2>
					<p className="mt-1 text-[16px] font-light leading-[19px] text-[#666]">
						최대 {MAX_GENRE_SELECTION}개까지 선택 가능합니다.
					</p>
				</div>

				<div className="relative -mx-2 px-2">
					<div className="genre-tag-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 py-2 pb-3">
						{GENRE_TAGS.map((tag) => {
							const isSelected = selectedGenres.includes(tag.id);
							const isDisabled =
								!isSelected && selectedGenres.length >= MAX_GENRE_SELECTION;

							return (
								<button
									key={tag.id}
									type="button"
									disabled={isDisabled}
									onClick={() => onToggleGenre(tag.id)}									className={`relative size-[140px] shrink-0 snap-start overflow-hidden rounded-[10px] border-[3px] transition ${
										isSelected
											? "border-brand"
											: "border-transparent"
									} ${isDisabled ? "opacity-40" : "hover:opacity-90"}`}>
									<img
										src={tag.image}
										alt={tag.label}
										className="size-full object-cover"
									/>
									{isSelected && (
										<div className="absolute inset-0 flex items-end justify-center bg-black/50 pb-4">
											<span className="text-[18px] font-bold text-white">
												{tag.label}
											</span>
										</div>
									)}
								</button>
							);
						})}
					</div>
				</div>
			</section>

			<section className="mb-10">
				<div className="mb-4">
					<h2 className="text-[20px] font-bold leading-6 text-black">프롬프트</h2>
					<p className="mt-1 text-[16px] font-light leading-[19px] text-[#666]">
						추가 스타일이나 원하는 도안을 작성해주세요
					</p>
				</div>

				<textarea
					value={prompt}
					onChange={(event) => onPromptChange(event.target.value)}
					placeholder="이곳에 작성해주세요."
					rows={5}
					className="w-full resize-none rounded-[10px] border border-[#D9D9D9] px-5 py-4 text-[16px] font-light leading-[22px] text-black outline-none transition placeholder:text-[#999] focus:border-brand"
				/>
			</section>

			<section className="mb-12">
				<div className="mb-4">
					<h2 className="text-[20px] font-bold leading-6 text-black">
						참고용 도안 이미지
					</h2>
					<p className="mt-1 text-[16px] font-light leading-[19px] text-[#666]">
						이미지는 최대 {MAX_REFERENCE_IMAGES}개까지 등록할 수 있어요.
					</p>
				</div>

				<div className="flex flex-wrap gap-4">
					{referenceImages.map((imageUrl, index) => (
						<div
							key={imageUrl}
							className="group relative size-[140px] overflow-hidden rounded-[10px]">
							<img
								src={imageUrl}
								alt={`참고 이미지 ${index + 1}`}
								className="size-full object-cover"
							/>
							<button
								type="button"
								onClick={() => onRemoveReferenceImage(index)}
								aria-label={`참고 이미지 ${index + 1} 삭제`}
								className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-sm text-white opacity-0 transition group-hover:opacity-100">
								×
							</button>
						</div>
					))}

					{referenceImages.length < MAX_REFERENCE_IMAGES && (
						<>
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								className="flex size-[140px] items-center justify-center rounded-[10px] border border-[#D9D9D9] bg-[#FAFAFA] transition hover:bg-[#F0F0F0]">
								<span className="text-[48px] font-light leading-none text-[#999]">
									+
								</span>
							</button>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								multiple
								className="hidden"
								onChange={(event) => {
									if (event.target.files?.length) {
										onAddReferenceImages(event.target.files);
										event.target.value = "";
									}
								}}
							/>
						</>
					)}
				</div>
			</section>

			<div className="flex justify-center">
				<button
					type="button"
					disabled={!canGenerate}
					onClick={onGenerate}
					className={`inline-flex h-[52px] min-w-[220px] items-center justify-center rounded-[50px] px-6 text-[20px] font-semibold leading-6 text-white transition ${
						canGenerate
							? "bg-brand hover:brightness-95 active:scale-[0.99]"
							: "cursor-not-allowed bg-[#FFB4B4]"
					}`}>
					도안 생성하기
				</button>
			</div>
		</div>
	);
}
