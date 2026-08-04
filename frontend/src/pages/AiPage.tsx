import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import demoTattoo from "../assets/images/demo-tattoo.png";
import AccordionSection from "../components/ai/AccordionSection";
import ImageDetailModal from "../components/ai/ImageDetailModal";
import ResultSection from "../components/ai/ResultSection";
import SaveConfirmModal from "../components/ai/SaveConfirmModal";
import StyleInputForm from "../components/ai/StyleInputForm";
import { MAX_REFERENCE_IMAGES } from "../components/ai/constants";
import { saveToArchive } from "../services/archiveApi";

const DEMO_TATTOO_IDS = [6, 9, 12];
const MAX_RESULT_SELECTION = 20;

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
	const [generatedResults, setGeneratedResults] = useState<{ imageUrl: string; tattooId: number }[]>([]);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [selectedResultIndices, setSelectedResultIndices] = useState<number[]>([]);
	const [detailImage, setDetailImage] = useState<string | null>(null);
	const [showSaveModal, setShowSaveModal] = useState(false);
	const [showLeaveModal, setShowLeaveModal] = useState(false);
	const [leaveTarget, setLeaveTarget] = useState<"home" | "input">("home");
	const [showLimitToast, setShowLimitToast] = useState(false);

	const canGenerate = prompt.trim().length > 0 || referenceImages.length > 0 || selectedGenres.length > 0;

	useEffect(() => {
		if (!showLimitToast) return;
		const timer = window.setTimeout(() => setShowLimitToast(false), 2200);
		return () => window.clearTimeout(timer);
	}, [showLimitToast]);

	const handleToggleGenre = useCallback((id: string) => {
		setSelectedGenres((prev) => prev.includes(id) ? prev.filter((genreId) => genreId !== id) : prev.length >= 2 ? prev : [...prev, id]);
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

	const handleGenerate = useCallback(() => {
		if (!canGenerate) return;
		setHasGenerated(true);
		setInputOpen(false);
		setResultOpen(true);
		setGeneratedResults(DEMO_TATTOO_IDS.map((tattooId) => ({ imageUrl: demoTattoo, tattooId })));
		setSelectedResultIndices([]);
		setSaveError(null);
		window.scrollTo({ top: 0, behavior: "smooth" });
	}, [canGenerate]);

	const handleGenerateMore = useCallback(() => {
		setGeneratedResults((prev) => [...prev, { imageUrl: demoTattoo, tattooId: DEMO_TATTOO_IDS[prev.length % DEMO_TATTOO_IDS.length] }]);
	}, []);

	const handleSave = useCallback(async () => {
		const tattooIds = selectedResultIndices.map((index) => generatedResults[index]?.tattooId).filter((id): id is number => typeof id === "number");
		if (tattooIds.length === 0) return;
		setSaving(true);
		setSaveError(null);
		try {
			await Promise.all(tattooIds.map((id) => saveToArchive(id)));
			setShowSaveModal(true);
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : "저장에 실패했습니다.");
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
		setGeneratedResults([]);
		setSelectedResultIndices([]);
		setShowLeaveModal(false);
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const inputForm = <StyleInputForm selectedGenres={selectedGenres} prompt={prompt} referenceImages={referenceImages} showHero={!hasGenerated} canGenerate={canGenerate} onToggleGenre={handleToggleGenre} onPromptChange={setPrompt} onAddReferenceImages={handleAddReferenceImages} onRemoveReferenceImage={handleRemoveReferenceImage} onGenerate={handleGenerate} />;

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
					{hasGenerated && <div className="mt-6"><AccordionSection title="생성 결과 도안" isOpen={resultOpen} onToggle={() => setResultOpen((prev) => !prev)}><ResultSection generatedImages={generatedResults.map((r) => r.imageUrl)} selectedIndices={selectedResultIndices} onToggleSelect={handleToggleResultSelect} onZoom={setDetailImage} onGenerateMore={handleGenerateMore} onSave={handleSave} saving={saving} saveError={saveError} /></AccordionSection></div>}
				</div>

				<div className="hidden max-lg:block">
					{hasGenerated ? <ResultSection generatedImages={generatedResults.map((r) => r.imageUrl)} selectedIndices={selectedResultIndices} onToggleSelect={handleToggleResultSelect} onZoom={setDetailImage} onGenerateMore={handleGenerateMore} onSave={handleSave} saving={saving} saveError={saveError} onMobileBack={requestInput} /> : inputForm}
				</div>
			</div>

			{showLimitToast && <div className="fixed left-1/2 top-1/2 z-[80] -translate-x-1/2 rounded-full bg-black/70 px-8 py-4 text-center text-[16px] font-semibold text-white max-lg:w-[calc(100%-32px)]">보관함이 꽉 차서 추가 선택할 수 없어요</div>}

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
			{showSaveModal && <SaveConfirmModal onClose={() => setShowSaveModal(false)} />}
		</div>
	);
}
