import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AccordionSection from "../components/ai/AccordionSection";
import ImageDetailModal from "../components/ai/ImageDetailModal";
import ResultSection from "../components/ai/ResultSection";
import StyleInputForm from "../components/ai/StyleInputForm";
import { GENRE_TAGS, MAX_REFERENCE_IMAGES } from "../components/ai/constants";
import { generateTattoo } from "../services/tattooGenerationApi";

const MAX_RESULT_SELECTION = 20;

type GeneratedResult = {
	imageUrl: string;
};

function HomeIcon() {
	return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 10.8 12 3l9 7.8V21h-6v-6H9v6H3V10.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}

function CloseIcon() {
	return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="m4 4 12 12M16 4 4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

export default function AiPage() {
	const navigate = useNavigate();
	const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
	const [prompt, setPrompt] = useState("");
	const [referenceImages, setReferenceImages] = useState<string[]>([]);
	const [hasGenerated, setHasGenerated] = useState(false);
	const [inputOpen, setInputOpen] = useState(true);
	const [resultOpen, setResultOpen] = useState(false);
	const [generatedResults, setGeneratedResults] = useState<GeneratedResult[]>([]);
	const [generating, setGenerating] = useState(false);
	const [generationError, setGenerationError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [selectedResultIndices, setSelectedResultIndices] = useState<number[]>([]);
	const [detailImage, setDetailImage] = useState<string | null>(null);
	const [showLeaveModal, setShowLeaveModal] = useState(false);
	const [leaveTarget, setLeaveTarget] = useState<"home" | "input">("home");
	const [showLimitToast, setShowLimitToast] = useState(false);
	const generatedObjectUrls = useRef<string[]>([]);

	const canGenerate = prompt.trim().length > 0;

	useEffect(() => {
		if (!showLimitToast) return;
		const timer = window.setTimeout(() => setShowLimitToast(false), 2200);
		return () => window.clearTimeout(timer);
	}, [showLimitToast]);

	useEffect(() => () => {
		generatedObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
	}, []);

	// 스타일은 한 개만 고른다. 고른 것을 다시 누르면 해제, 다른 것을 누르면 교체다.
	const handleToggleGenre = useCallback((id: string) => {
		setSelectedGenres((prev) => (prev.includes(id) ? [] : [id]));
	}, []);

	const handleAddReferenceImages = useCallback((files: FileList) => {
		const remaining = MAX_REFERENCE_IMAGES - referenceImages.length;
		const newUrls = Array.from(files).slice(0, remaining).map((file) => URL.createObjectURL(file));
		setReferenceImages((prev) => [...prev, ...newUrls].slice(0, MAX_REFERENCE_IMAGES));
	}, [referenceImages.length]);

	const handleRemoveReferenceImage = useCallback((index: number) => {
		setReferenceImages((prev) => {
			const target = prev[index];
			if (target) URL.revokeObjectURL(target);
			return prev.filter((_, i) => i !== index);
		});
	}, []);

	const handleToggleResultSelect = useCallback((index: number) => {
		setSelectedResultIndices((prev) => {
			if (prev.includes(index)) return prev.filter((item) => item !== index);
			if (prev.length >= MAX_RESULT_SELECTION) {
				setShowLimitToast(true);
				return prev;
			}
			return [...prev, index];
		});
	}, []);

	const requestGeneratedTattoo = useCallback(async (): Promise<GeneratedResult> => {
		const styles = selectedGenres.flatMap((id) => {
			const tag = GENRE_TAGS.find((item) => item.id === id);
			return tag ? [tag.apiStyle] : [];
		});
		// 참고 이미지는 UI에만 유지하며 현재 생성 API 요청에는 포함하지 않는다.
		const blob = await generateTattoo({
			prompt: prompt.trim(),
			style: styles,
			steps: 25,
			guidance: 7.5,
			size: 512,
		});
		const imageUrl = URL.createObjectURL(blob);
		generatedObjectUrls.current.push(imageUrl);
		return { imageUrl };
	}, [prompt, selectedGenres]);

	const handleGenerate = useCallback(async () => {
		if (!canGenerate || generating) return;
		setGenerating(true);
		setGenerationError(null);
		setSaveError(null);
		try {
			const result = await requestGeneratedTattoo();
			setGeneratedResults([result]);
			setSelectedResultIndices([]);
			setHasGenerated(true);
			setInputOpen(false);
			setResultOpen(true);
			window.scrollTo({ top: 0, behavior: "smooth" });
		} catch (error) {
			setGenerationError(error instanceof Error ? error.message : "도안 생성에 실패했습니다.");
		} finally {
			setGenerating(false);
		}
	}, [canGenerate, generating, requestGeneratedTattoo]);

	const handleGenerateMore = useCallback(async () => {
		if (!canGenerate || generating || generatedResults.length >= MAX_RESULT_SELECTION) return;
		setGenerating(true);
		setGenerationError(null);
		try {
			const result = await requestGeneratedTattoo();
			setGeneratedResults((prev) => [...prev, result]);
		} catch (error) {
			setGenerationError(error instanceof Error ? error.message : "도안 생성에 실패했습니다.");
		} finally {
			setGenerating(false);
		}
	}, [canGenerate, generatedResults.length, generating, requestGeneratedTattoo]);

	const handleSave = useCallback(async () => {
		const selectedResults = selectedResultIndices
			.map((index) => generatedResults[index])
			.filter((result): result is GeneratedResult => result != null);
		if (selectedResults.length === 0) return;
		setSaving(true);
		setSaveError(null);
		try {
			selectedResults.forEach((result, index) => {
				const link = document.createElement("a");
				link.href = result.imageUrl;
				link.download = `starttoo-generated-tattoo-${Date.now()}-${index + 1}.png`;
				document.body.appendChild(link);
				link.click();
				link.remove();
			});
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : "다운로드에 실패했습니다.");
		} finally {
			setSaving(false);
		}
	}, [selectedResultIndices, generatedResults]);

	const requestHome = () => {
		if (!hasGenerated) {
			navigate("/");
			return;
		}
		setLeaveTarget("home");
		setShowLeaveModal(true);
	};

	const requestInput = () => {
		setLeaveTarget("input");
		setShowLeaveModal(true);
	};

	const confirmLeave = () => {
		if (leaveTarget === "home") {
			navigate("/");
			return;
		}
		setHasGenerated(false);
		setInputOpen(true);
		setResultOpen(false);
		generatedObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
		generatedObjectUrls.current = [];
		setGeneratedResults([]);
		setSelectedResultIndices([]);
		setGenerationError(null);
		setShowLeaveModal(false);
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const inputForm = <StyleInputForm selectedGenres={selectedGenres} prompt={prompt} referenceImages={referenceImages} showHero={!hasGenerated} canGenerate={canGenerate} generating={generating} generationError={generationError} onToggleGenre={handleToggleGenre} onPromptChange={setPrompt} onAddReferenceImages={handleAddReferenceImages} onRemoveReferenceImage={handleRemoveReferenceImage} onGenerate={handleGenerate} />;

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface px-6 py-10 max-lg:min-h-[calc(100vh-50px)] max-lg:px-0 max-lg:py-0">
			<header className="fixed inset-x-0 top-0 z-[70] hidden h-[50px] items-center justify-center border-b border-[#E8E8E8] bg-white max-lg:flex">
				<button type="button" aria-label="홈으로 이동" onClick={requestHome} className="absolute left-4 flex size-8 items-center justify-center text-[#555]"><HomeIcon /></button>
				<h1 className="text-[20px] font-bold">AI 도안 생성</h1>
			</header>

			<div className="mx-auto flex max-w-[960px] flex-col gap-6 max-lg:block">
				<div className="max-lg:hidden">
					{hasGenerated ? (
						<AccordionSection title="스타일 태그 / 프롬프트 / 이미지" isOpen={inputOpen} onToggle={() => setInputOpen((prev) => !prev)}>{inputForm}</AccordionSection>
					) : <div className="rounded-[10px] border border-[#E8E8E8] bg-white">{inputForm}</div>}
					{hasGenerated && <div className="mt-6"><AccordionSection title="생성 결과 도안" isOpen={resultOpen} onToggle={() => setResultOpen((prev) => !prev)}><ResultSection generatedImages={generatedResults.map((r) => r.imageUrl)} selectedIndices={selectedResultIndices} onToggleSelect={handleToggleResultSelect} onZoom={setDetailImage} onGenerateMore={handleGenerateMore} onSave={handleSave} generating={generating} canGenerateMore={canGenerate} generationError={generationError} saving={saving} saveError={saveError} /></AccordionSection></div>}
				</div>

				<div className="hidden max-lg:block">
					{hasGenerated ? <ResultSection generatedImages={generatedResults.map((r) => r.imageUrl)} selectedIndices={selectedResultIndices} onToggleSelect={handleToggleResultSelect} onZoom={setDetailImage} onGenerateMore={handleGenerateMore} onSave={handleSave} generating={generating} canGenerateMore={canGenerate} generationError={generationError} saving={saving} saveError={saveError} onMobileBack={requestInput} /> : inputForm}
				</div>
			</div>

			{showLimitToast && <div className="fixed left-1/2 top-1/2 z-[80] -translate-x-1/2 rounded-full bg-black/70 px-8 py-4 text-center text-[16px] font-semibold text-white max-lg:w-[calc(100%-32px)]">도안 보관함이 꽉 차서 추가 선택할 수 없어요</div>}

			{showLeaveModal && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4" role="presentation" onClick={() => setShowLeaveModal(false)}>
					<div className="relative w-full max-w-[344px] rounded-[10px] bg-white px-8 pb-7 pt-10" role="dialog" aria-modal="true" aria-label="도안 생성 화면 나가기" onClick={(event) => event.stopPropagation()}>
						<button type="button" aria-label="닫기" onClick={() => setShowLeaveModal(false)} className="absolute right-4 top-4 text-[#40505D]"><CloseIcon /></button>
						<p className="text-center text-[18px] font-semibold leading-6">{leaveTarget === "home" ? "홈으로 이동하면" : "이전 단계로 돌아가면"}<br />지금까지 생성한 도안 이미지는 <span className="text-brand">삭제</span>됩니다.</p>
						<p className="mt-3 text-center text-[17px]">{leaveTarget === "home" ? "홈으로 이동하시겠습니까?" : "이전 단계로 돌아가시겠습니까?"}</p>
						<div className="mt-6 flex gap-7">
							<button type="button" onClick={confirmLeave} className="h-11 flex-1 rounded-full bg-[#D9D9D9] text-[16px] font-semibold">{leaveTarget === "home" ? "홈으로 가기" : "이전 단계"}</button>
							<button type="button" onClick={() => setShowLeaveModal(false)} className="h-11 flex-1 rounded-full bg-brand text-[16px] font-semibold text-white">아니오</button>
						</div>
					</div>
				</div>
			)}

			{detailImage && <ImageDetailModal imageUrl={detailImage} onClose={() => setDetailImage(null)} />}
		</div>
	);
}
