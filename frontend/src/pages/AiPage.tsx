import { useCallback, useState } from "react";
import demoTattoo from "../assets/images/demo-tattoo.png";
import AccordionSection from "../components/ai/AccordionSection";
import ImageDetailModal from "../components/ai/ImageDetailModal";
import ResultSection from "../components/ai/ResultSection";
import SaveConfirmModal from "../components/ai/SaveConfirmModal";
import StyleInputForm from "../components/ai/StyleInputForm";
import { MAX_REFERENCE_IMAGES } from "../components/ai/constants";
import { saveToArchive } from "../services/archiveApi";

// 데모 스탠드인: 시드에 존재하는 실제 AI 도안 tattooId (백엔드 저장 검증용)
// TODO: AI 생성(POST /ai/generations) 연동 시 생성 응답의 tattooId로 교체
const DEMO_TATTOO_IDS = [6, 9, 12];

export default function AiPage() {
	const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
	const [prompt, setPrompt] = useState("");
	const [referenceImages, setReferenceImages] = useState<string[]>([]);
	const [hasGenerated, setHasGenerated] = useState(false);
	const [inputOpen, setInputOpen] = useState(true);
	const [resultOpen, setResultOpen] = useState(false);
	const [generatedResults, setGeneratedResults] = useState<
		{ imageUrl: string; tattooId: number }[]
	>([]);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
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
		setGeneratedResults([
			{ imageUrl: demoTattoo, tattooId: DEMO_TATTOO_IDS[0] },
		]);
		setSelectedResultIndices([0]);
		setSaveError(null);
	}, [canGenerate]);

	const handleGenerateMore = useCallback(() => {
		setGeneratedResults((prev) => [
			...prev,
			{
				imageUrl: demoTattoo,
				tattooId: DEMO_TATTOO_IDS[prev.length % DEMO_TATTOO_IDS.length],
			},
		]);
	}, []);

	const handleSave = useCallback(async () => {
		const tattooIds = selectedResultIndices
			.map((index) => generatedResults[index]?.tattooId)
			.filter((id): id is number => typeof id === "number");
		if (tattooIds.length === 0) {
			return;
		}
		setSaving(true);
		setSaveError(null);
		try {
			await Promise.all(tattooIds.map((id) => saveToArchive(id)));
			setShowSaveModal(true);
		} catch (err) {
			setSaveError(
				err instanceof Error ? err.message : "저장에 실패했습니다.",
			);
		} finally {
			setSaving(false);
		}
	}, [selectedResultIndices, generatedResults]);

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
							generatedImages={generatedResults.map((r) => r.imageUrl)}
							selectedIndices={selectedResultIndices}
							onToggleSelect={handleToggleResultSelect}
							onZoom={setDetailImage}
							onGenerateMore={handleGenerateMore}
							onSave={handleSave}
							saving={saving}
							saveError={saveError}
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
