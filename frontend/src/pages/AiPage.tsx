import { useCallback, useState } from "react";
import demoTattoo from "../assets/images/demo-tattoo.png";
import AccordionSection from "../components/ai/AccordionSection";
import ImageDetailModal from "../components/ai/ImageDetailModal";
import ResultSection from "../components/ai/ResultSection";
import SaveConfirmModal from "../components/ai/SaveConfirmModal";
import StyleInputForm from "../components/ai/StyleInputForm";
import { MAX_REFERENCE_IMAGES } from "../components/ai/constants";

export default function AiPage() {
	const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
	const [prompt, setPrompt] = useState("");
	const [referenceImages, setReferenceImages] = useState<string[]>([]);
	const [hasGenerated, setHasGenerated] = useState(false);
	const [inputOpen, setInputOpen] = useState(true);
	const [resultOpen, setResultOpen] = useState(false);
	const [generatedImages, setGeneratedImages] = useState<string[]>([]);
	const [selectedResultIndices, setSelectedResultIndices] = useState<number[]>(
		[],
	);
	const [detailImage, setDetailImage] = useState<string | null>(null);
	const [showSaveModal, setShowSaveModal] = useState(false);

	const canGenerate =
		prompt.trim().length > 0 || referenceImages.length > 0;

	const handleToggleGenre = useCallback((id: string) => {
		setSelectedGenres((prev) => {
			if (prev.includes(id)) {
				return prev.filter((genreId) => genreId !== id);
			}
			if (prev.length >= 2) {
				return prev;
			}
			return [...prev, id];
		});
	}, []);

	const handleAddReferenceImages = useCallback((files: FileList) => {
		const remaining = MAX_REFERENCE_IMAGES - referenceImages.length;
		const newUrls = Array.from(files)
			.slice(0, remaining)
			.map((file) => URL.createObjectURL(file));

		setReferenceImages((prev) => [...prev, ...newUrls].slice(0, MAX_REFERENCE_IMAGES));
	}, [referenceImages.length]);

	const handleRemoveReferenceImage = useCallback((index: number) => {
		setReferenceImages((prev) => {
			const target = prev[index];
			if (target) {
				URL.revokeObjectURL(target);
			}
			return prev.filter((_, i) => i !== index);
		});
	}, []);

	const handleToggleResultSelect = useCallback((index: number) => {
		setSelectedResultIndices((prev) =>
			prev.includes(index)
				? prev.filter((item) => item !== index)
				: [...prev, index],
		);
	}, []);

	const handleGenerate = useCallback(() => {
		if (!canGenerate) {
			return;
		}

		setHasGenerated(true);
		setInputOpen(false);
		setResultOpen(true);
		setGeneratedImages([demoTattoo]);
		setSelectedResultIndices([0]);
	}, [canGenerate]);

	const handleGenerateMore = useCallback(() => {
		setGeneratedImages((prev) => [...prev, demoTattoo]);
	}, []);

	const inputForm = (
		<StyleInputForm
			selectedGenres={selectedGenres}
			prompt={prompt}
			referenceImages={referenceImages}
			showHero={!hasGenerated}
			canGenerate={canGenerate}
			onToggleGenre={handleToggleGenre}
			onPromptChange={setPrompt}
			onAddReferenceImages={handleAddReferenceImages}
			onRemoveReferenceImage={handleRemoveReferenceImage}
			onGenerate={handleGenerate}
		/>
	);

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface px-6 py-10">
			<div className="mx-auto flex max-w-[960px] flex-col gap-6">
				{hasGenerated ? (
					<AccordionSection
						title="스타일 태그 / 프롬프트 / 이미지"
						isOpen={inputOpen}
						onToggle={() => setInputOpen((prev) => !prev)}>
						{inputForm}
					</AccordionSection>
				) : (
					<div className="rounded-[10px] border border-[#E8E8E8] bg-white">
						{inputForm}
					</div>
				)}

				{hasGenerated && (
					<AccordionSection
						title="생성 결과 도안"
						isOpen={resultOpen}
						onToggle={() => setResultOpen((prev) => !prev)}>
						<ResultSection
							generatedImages={generatedImages}
							selectedIndices={selectedResultIndices}
							onToggleSelect={handleToggleResultSelect}
							onZoom={setDetailImage}
							onGenerateMore={handleGenerateMore}
							onSave={() => setShowSaveModal(true)}
						/>
					</AccordionSection>
				)}
			</div>

			{detailImage && (
				<ImageDetailModal
					imageUrl={detailImage}
					onClose={() => setDetailImage(null)}
				/>
			)}

			{showSaveModal && (
				<SaveConfirmModal onClose={() => setShowSaveModal(false)} />
			)}
		</div>
	);
}
