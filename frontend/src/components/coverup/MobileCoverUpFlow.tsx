import { useState, type RefObject } from "react";
import type { DesignResult, SearchMode } from "../../types/shapeSearch";
import ShapeCanvas from "./ShapeCanvas";
import { MODE_KEYS, MODES } from "./shapeSearchConstants";
import LoadingLabel from "../loader/LoadingLabel";
import Simulation3DStep from "../simulation/Simulation3DStep";
import type { BodyScanResult } from "../simulation/useBodyScan";

type CanvasProps = React.ComponentProps<typeof ShapeCanvas>;

type MobileCoverUpFlowProps = {
	/** 4 = 고른 도안을 내 사진에 얹어 보는 단계 (PC와 같은 STEP 4) */
	step: 1 | 2 | 3 | 4;
	/** 그리기 방식 — 면(coverup) / 선(shape) */
	mode: SearchMode;
	onModeChange: (mode: SearchMode) => void;
	/** STEP 4에서 쓰는 신체 분석 결과 */
	bodyScan: BodyScanResult;
	fileInputRef: RefObject<HTMLInputElement | null>;
	previewUrl: string | null;
	fileError: string | null;
	onSelectFile: (file: File) => void;
	onPickFile: () => void;
	canvasProps: CanvasProps;
	canUndo: boolean;
	onUndo: () => void;
	onClear: () => void;
	onBack: () => void;
	onNext: () => void;
	nextDisabled: boolean;
	isSearching: boolean;
	searchMessage: string | null;
	/** 면 모드에서 획이 안 닫혔을 때의 그리기 안내 (오류가 아니라 회색으로 둔다) */
	openShapeHint: string | null;
	results: DesignResult[];
	selectedIndex: number;
	onSelectResult: (index: number) => void;
	onSave: () => void;
	onSimulate: () => void;
	isSaving: boolean;
	saveError: string | null;
	isSavedOpen: boolean;
	onCloseSaved: () => void;
};

function BackIcon() {
	return <svg width="20" height="24" viewBox="0 0 20 24" fill="none" aria-hidden><path d="m15 3-9 9 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CloseIcon() {
	return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="m4 4 12 12M16 4 4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function HomeIcon() {
	return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 10.8 12 3l9 7.8V21h-6v-6H9v6H3V10.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}

function Header({ onHome }: { onHome: () => void }) {
	return (
		<header className="fixed inset-x-0 top-0 z-[70] flex h-[50px] items-center justify-center border-b border-[#E8E8E8] bg-white">
			<button type="button" onClick={onHome} aria-label="홈으로 가기" className="absolute left-4 flex size-8 items-center justify-center text-[#555]"><HomeIcon /></button>
			<h1 className="text-[19px] font-bold">커버업 타투 도안 추천</h1>
		</header>
	);
}

function BottomButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
	return <button type="button" disabled={disabled} onClick={onClick} className="fixed inset-x-0 bottom-0 z-40 h-[60px] rounded-t-[10px] bg-brand text-[20px] font-bold text-white disabled:cursor-not-allowed disabled:bg-[#D9D9D9] disabled:text-[#A7A7A7]">{children}</button>;
}

export default function MobileCoverUpFlow({
	step,
	mode,
	onModeChange,
	bodyScan,
	fileInputRef,
	previewUrl,
	fileError,
	onSelectFile,
	onPickFile,
	canvasProps,
	canUndo,
	onUndo,
	onClear,
	onBack,
	onNext,
	nextDisabled,
	isSearching,
	searchMessage,
	openShapeHint,
	results,
	selectedIndex,
	onSelectResult,
	onSave,
	onSimulate,
	isSaving,
	saveError,
	isSavedOpen,
	onCloseSaved,
}: MobileCoverUpFlowProps) {
	const selected = results[selectedIndex] ?? null;
	const [homeConfirmOpen, setHomeConfirmOpen] = useState(false);
	const goHome = () => window.location.assign("/");
	const handleHome = () => step === 1 ? goHome() : setHomeConfirmOpen(true);

	return (
		<div className="min-h-[calc(100vh-var(--nav-h))] bg-surface px-4 pb-24 pt-6">
			<Header onHome={handleHome} />

			{step === 1 && (
				<>
					<h2 className="mb-6 text-center text-[18px] font-semibold leading-6">흉터나 타투가 있는 부위의 사진을 업로드해주세요.</h2>
					<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onSelectFile(file); event.target.value = ""; }} />
					{previewUrl ? (
						<>
							<div className="w-full overflow-hidden rounded-[10px] bg-black">
								<img src={previewUrl} alt="업로드한 부위" className="h-auto max-h-[320px] w-full object-contain" />
							</div>
							<button type="button" onClick={onPickFile} className="mx-auto mt-4 flex h-12 w-[76%] items-center justify-center rounded-full border border-black bg-white text-[16px] font-semibold">↻&nbsp;&nbsp;다시 올리기</button>
						</>
					) : (
						<>
							<button type="button" onClick={onPickFile} className="mx-auto flex size-[110px] items-center justify-center rounded-[10px] border border-[#D6D6D6] bg-white text-[40px] font-extralight text-[#AFAFAF]">＋</button>
							<p className="mt-4 text-center text-[14px] font-light text-[#B7B7B7]">JPG, JPEG, PNG, WEBP 형식 지원</p>
						</>
					)}
					{fileError && <p className="mt-4 text-center text-[13px] text-brand">{fileError}</p>}
					<BottomButton disabled={nextDisabled} onClick={onNext}>다음</BottomButton>
				</>
			)}

			{step === 2 && (
				<>
					<div className="relative mb-5 flex min-h-8 items-center justify-center">
						<button type="button" onClick={onBack} aria-label="이전 단계" className="absolute left-0 flex size-8 items-center justify-center text-[#BDBDBD]"><BackIcon /></button>
						<h2 className="text-center text-[19px] font-semibold">덮을 영역을 그려주세요</h2>
					</div>
					{/* 무엇을 그릴지 먼저 고르도록 캔버스 위에 둔다 (PC와 같은 자리) */}
					<div className="mx-auto mb-3 flex h-[40px] w-full max-w-[240px] items-center rounded-[12px] bg-white p-1 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
						{MODE_KEYS.map((key) => (
							<button
								key={key}
								type="button"
								aria-pressed={mode === key}
								onClick={() => onModeChange(key)}
								className={`h-full flex-1 rounded-[9px] text-[14px] font-semibold transition ${mode === key ? "bg-surface text-black" : "text-black/40"}`}>
								{MODES[key].label}
							</button>
						))}
					</div>
					<p className="mb-3 text-center text-[13px] font-light text-black/50">{MODES[mode].hint}</p>
					<div className="mx-auto flex h-[430px] w-full max-w-[420px] items-center justify-center overflow-hidden rounded-[12px]">
						<ShapeCanvas {...canvasProps} />
					</div>
					<div className="mx-auto mt-4 flex w-full max-w-[420px] gap-3">
						<button type="button" disabled={!canUndo} onClick={onUndo} className="h-11 flex-1 rounded-full border border-black bg-white text-[14px] font-semibold disabled:opacity-40">되돌리기</button>
						<button type="button" disabled={!canUndo} onClick={onClear} className="h-11 flex-1 rounded-full border border-black bg-white text-[14px] font-semibold disabled:opacity-40">지우기</button>
					</div>
					{searchMessage && <p className="mt-4 text-center text-[13px] text-brand">{searchMessage}</p>}
					{!searchMessage && openShapeHint && <p className="mt-4 text-center text-[13px] font-light text-black/55">{openShapeHint}</p>}
					<BottomButton disabled={nextDisabled} onClick={onNext}>
						{isSearching ? <LoadingLabel>추천 중…</LoadingLabel> : "타투 추천받기"}
					</BottomButton>
				</>
			)}

			{step === 3 && selected && (
				<>
					<div className="relative mb-5 flex min-h-8 items-center justify-center">
						<button type="button" onClick={onBack} aria-label="이전 단계" className="absolute left-0 flex size-8 items-center justify-center text-[#BDBDBD]"><BackIcon /></button>
						<h2 className="text-center text-[19px] font-semibold">추천 도안을 선택해주세요</h2>
					</div>
					<div className="mx-auto flex h-[245px] w-full max-w-[420px] items-center justify-center overflow-hidden rounded-[12px] border border-[#D7D7D7] bg-white">
						<img src={selected.imageUrl} alt="선택한 추천 도안" className="size-full object-cover" />
					</div>
					<p className="mt-3 text-center text-[13px] text-[#999]">도안을 좌우로 밀어 원하는 이미지를 선택하세요</p>
					<div className="-mx-4 mt-2.5 flex snap-x gap-2 overflow-x-auto px-4 pb-2 scroll-pl-4">
						{results.map((result, index) => (
							<button key={result.tattooSeq} type="button" onClick={() => onSelectResult(index)} aria-pressed={selectedIndex === index} className={`size-[82px] shrink-0 snap-start overflow-hidden rounded-[10px] bg-white transition ${selectedIndex === index ? "border-[3px] border-brand" : "border border-[#D7D7D7]"}`}>
								<img src={result.imageUrl} alt={`추천 도안 ${index + 1}`} className="size-full object-cover" />
							</button>
						))}
					</div>
					<div className="mt-4 flex gap-3">
						<button type="button" disabled={isSaving} onClick={onSave} className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-brand bg-white text-[15px] font-semibold text-brand disabled:opacity-50">
							{isSaving ? <LoadingLabel>저장 중…</LoadingLabel> : "도안보관함에 저장"}
						</button>
						<button type="button" onClick={onSimulate} className="h-12 flex-1 rounded-full bg-brand text-[15px] font-semibold text-white">시뮬레이션</button>
					</div>
					{saveError && <p className="mt-3 text-center text-[13px] text-brand">{saveError}</p>}
				</>
			)}

			{/* STEP 4 — 고른 도안을 내 사진에 얹어 본다. PC와 같은 화면을 쓴다. */}
			{step === 4 && (
				<>
					<div className="relative mb-4 flex min-h-8 items-center justify-center">
						<button type="button" onClick={onBack} aria-label="이전 단계" className="absolute left-0 flex size-8 items-center justify-center text-[#BDBDBD]"><BackIcon /></button>
						<h2 className="text-center text-[19px] font-semibold">타투를 배치해보세요</h2>
					</div>
					<div className="h-[calc(100dvh-230px)] min-h-[420px] w-full">
						<Simulation3DStep designUrl={selected?.imageUrl ?? null} scan={bodyScan} />
					</div>
				</>
			)}

			{isSavedOpen && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4" role="presentation" onClick={onCloseSaved}>
					<div className="relative w-full max-w-[344px] rounded-[12px] bg-white px-7 pb-7 pt-10 text-center" role="dialog" aria-modal="true" aria-label="도안 저장 완료" onClick={(event) => event.stopPropagation()}>
						<button type="button" aria-label="닫기" onClick={onCloseSaved} className="absolute right-4 top-4 text-[#40505D]"><CloseIcon /></button>
						<div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand/10 text-[26px] text-brand">✓</div>
						<h2 className="mt-4 text-[20px] font-bold">도안이 저장되었습니다</h2>
						<p className="mt-2 text-[14px] text-[#777]">저장한 도안으로 시뮬레이션을 시작할 수 있어요.</p>
						<div className="mt-7 flex gap-3">
							<button type="button" onClick={goHome} className="h-11 flex-1 rounded-full bg-[#E2E2E2] text-[15px] font-semibold text-[#555]">홈으로 가기</button>
							<button type="button" onClick={onSimulate} className="h-11 flex-1 rounded-full bg-brand text-[15px] font-semibold text-white">시뮬레이션</button>
						</div>
					</div>
				</div>
			)}

			{homeConfirmOpen && (
				<div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 px-4" role="presentation" onClick={() => setHomeConfirmOpen(false)}>
					<div className="relative w-full max-w-[344px] rounded-[12px] bg-white px-7 pb-7 pt-10 text-center" role="dialog" aria-modal="true" aria-label="커버업 작업 종료" onClick={(event) => event.stopPropagation()}>
						<button type="button" aria-label="닫기" onClick={() => setHomeConfirmOpen(false)} className="absolute right-4 top-4 text-[#40505D]"><CloseIcon /></button>
						<h2 className="text-[20px] font-bold">홈으로 이동할까요?</h2>
						<p className="mt-3 text-[14px] leading-5 text-[#777]">지금까지 진행한 커버업 작업 내용은 사라집니다.</p>
						<div className="mt-7 flex gap-3">
							<button type="button" onClick={() => setHomeConfirmOpen(false)} className="h-11 flex-1 rounded-full bg-[#E2E2E2] text-[15px] font-semibold text-[#555]">계속 작업</button>
							<button type="button" onClick={goHome} className="h-11 flex-1 rounded-full bg-brand text-[15px] font-semibold text-white">홈으로 가기</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
