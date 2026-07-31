import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import ActionButton from "../components/common/ActionButton";
import ConfirmModal from "../components/common/ConfirmModal";
import ImageViewerModal from "../components/common/ImageViewerModal";
import ResultsGrid from "../components/coverup/ResultsGrid";
import ShapeCanvas from "../components/coverup/ShapeCanvas";
import StepHeader from "../components/coverup/StepHeader";
import UploadBox from "../components/coverup/UploadBox";
import useCanvasStrokes from "../components/coverup/useCanvasStrokes";
import { describeSearchError } from "../components/coverup/shapeSearchError";
import {
	DEFAULT_MODE,
	MAX_BRUSH,
	MIN_BRUSH,
	MODE_KEYS,
	MODES,
} from "../components/coverup/shapeSearchConstants";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../constants/upload";
import useShapeSearchMutation from "../hooks/mutations/useShapeSearch";
import useRequireAuth from "../hooks/useRequireAuth";
import { saveToArchive } from "../services/archiveApi";
import type { SearchMode } from "../types/shapeSearch";

type Step = 1 | 2 | 3;

function ReloadIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round">
			<path d="M21 12a9 9 0 1 1-2.64-6.36" />
			<path d="M21 3v6h-6" />
		</svg>
	);
}

export default function CoverUpPage() {
	const navigate = useNavigate();
	const reloadInputRef = useRef<HTMLInputElement>(null);
	const { requireAuth } = useRequireAuth();

	const [step, setStep] = useState<Step>(1);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [fileError, setFileError] = useState<string | null>(null);
	const [mode, setMode] = useState<SearchMode>(DEFAULT_MODE);
	// 획 없이 검색을 누른 경우. 요청은 보내지 않고 안내만 띄운다
	const [showEmptyStrokeHint, setShowEmptyStrokeHint] = useState(false);
	const [isStale, setStale] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isViewerOpen, setViewerOpen] = useState(false);
	const [isSavedOpen, setSavedOpen] = useState(false);

	const canvas = useCanvasStrokes(mode);
	const searchMutation = useShapeSearchMutation();
	const saveMutation = useMutation({ mutationFn: saveToArchive });

	const results = searchMutation.data ?? [];
	const selectedResult = results[selectedIndex] ?? null;
	const errorInfo = searchMutation.isError
		? describeSearchError(searchMutation.error)
		: null;
	const hasEmptyResult = searchMutation.isSuccess && results.length === 0;

	useEffect(
		() => () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		},
		[previewUrl],
	);

	// 기능명세 4-2: 미지원 형식·용량 초과 시 업로드를 중단하고 오류를 안내
	const handleSelectFile = (nextFile: File) => {
		if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(nextFile.type)) {
			setFileError("JPG, PNG, WEBP 형식만 업로드할 수 있어요.");
			return;
		}
		if (nextFile.size > MAX_IMAGE_SIZE) {
			setFileError("이미지는 최대 10MB까지 업로드할 수 있어요.");
			return;
		}
		const nextUrl = URL.createObjectURL(nextFile);
		setFileError(null);
		setPreviewUrl(nextUrl);
		canvas.loadPhoto(nextUrl);
		canvas.clear();
		searchMutation.reset();
		setStale(false);
		setShowEmptyStrokeHint(false);
	};

	const handleReloadChange = (e: ChangeEvent<HTMLInputElement>) => {
		const nextFile = e.target.files?.[0];
		if (nextFile) handleSelectFile(nextFile);
		e.target.value = "";
	};

	/** 모드를 바꾸면 붓 굵기를 그 모드 기본값으로 되돌리고 기존 결과를 비운다 */
	const switchMode = (next: SearchMode) => {
		if (next === mode) return;
		setMode(next);
		canvas.resetBrush(next);
		searchMutation.reset();
		setStale(false);
		setShowEmptyStrokeHint(false);
	};

	const runSearch = () => {
		const maskPngB64 = canvas.buildMask();
		if (!maskPngB64) {
			setShowEmptyStrokeHint(true);
			return;
		}
		setShowEmptyStrokeHint(false);
		setStale(false);
		searchMutation.mutate(
			{ maskPngB64, mode },
			{
				onSuccess: (nextResults) => {
					setSelectedIndex(0);
					// 결과가 없으면 그림을 바로 고칠 수 있게 STEP 2에 머문다
					if (nextResults.length > 0) setStep(3);
				},
			},
		);
	};

	// 기능명세 4-4: 현재 결과를 초기화하고 처음부터 다시 진행
	const handleReset = () => {
		setStep(1);
		setPreviewUrl(null);
		setFileError(null);
		setMode(DEFAULT_MODE);
		canvas.loadPhoto(null);
		canvas.clear();
		canvas.resetBrush(DEFAULT_MODE);
		searchMutation.reset();
		saveMutation.reset();
		setStale(false);
		setShowEmptyStrokeHint(false);
		setSelectedIndex(0);
	};

	const handleSave = () => {
		if (!selectedResult) return;
		// 서버가 돌려주는 saved 값은 ApiResponse 봉투에 싸여 있어 아직 신뢰할 수 없다.
		// 예외 없이 끝나면 저장된 것으로 본다. (전역 언랩 작업에서 정리)
		saveMutation.mutate(selectedResult.tattooSeq, {
			onSuccess: () => setSavedOpen(true),
		});
	};

	return (
		<div className="flex min-h-[calc(100vh-60px)] flex-col items-center bg-surface px-6 pb-10">
			{/* 기능명세 4-1: 서비스 소개 섹션 */}
			<p className="mt-6 text-[14px] font-light text-black/60">
				흉터도, 오래된 타투도 새롭게
			</p>
			<h1 className="mt-1 text-[28px] font-extrabold text-black">
				커버업 타투 도안 추천
			</h1>
			<p className="mt-2 text-center text-[14px] font-light text-black/50">
				사진을 올리고 가릴 부위를 그리면, 그 형태를 닮은 타투 도안을
				찾아드려요.
			</p>

			<div
				className={`mt-6 flex w-full flex-col items-center ${
					step === 3 ? "max-w-[880px]" : "max-w-[560px]"
				}`}>
				{step === 1 && !previewUrl && (
					<>
						<StepHeader
							step={1}
							description="커버업하고 싶은 흉터나 타투가 있는 부위의 사진을 업로드해주세요."
						/>
						<div className="mt-5 w-full">
							<UploadBox onSelect={handleSelectFile} />
						</div>
						{fileError && (
							<p className="mt-4 text-[14px] text-brand">{fileError}</p>
						)}
					</>
				)}

				{step === 1 && previewUrl && (
					<>
						<StepHeader
							step={1}
							description="커버업하고 싶은 흉터나 타투가 있는 부위의 사진을 업로드해주세요."
						/>
						<div className="mt-5 w-full">
							<ShapeCanvas
								canvasRef={canvas.canvasRef}
								redraw={canvas.redraw}
								handlers={canvas.handlers}
							/>
						</div>
						{fileError && (
							<p className="mt-4 text-[14px] text-brand">{fileError}</p>
						)}
						<div className="mt-5 flex gap-4">
							<ActionButton
								variant="outline"
								onClick={() => reloadInputRef.current?.click()}>
								<ReloadIcon />
								다시 올리기
							</ActionButton>
							<ActionButton onClick={() => setStep(2)}>다음</ActionButton>
						</div>
					</>
				)}

				{step === 2 && (
					<>
						<StepHeader
							step={2}
							description="가릴 부위를 따라 그려주세요. 그린 형태를 닮은 도안을 찾아드려요."
						/>

						{/* 모드별로 붓 굵기가 다르다 (shape 6px · coverup 16px) */}
						<div className="mt-5 flex flex-col items-center gap-2">
							<div className="flex gap-2">
								{MODE_KEYS.map((key) => (
									<button
										key={key}
										type="button"
										onClick={() => switchMode(key)}
										className={`h-9 rounded-full px-4 text-[13px] font-semibold transition ${
											mode === key
												? "bg-brand text-white"
												: "border border-black/15 bg-white text-black/60 hover:bg-black/5"
										}`}>
										{MODES[key].label}
									</button>
								))}
							</div>
							<p className="text-[13px] font-light text-black/50">
								{MODES[mode].hint}
							</p>
						</div>

						<label className="mt-4 flex items-center gap-3 text-[13px] font-light text-black/60">
							<span className="w-[64px]">붓 {canvas.brush}px</span>
							<input
								type="range"
								min={MIN_BRUSH}
								max={MAX_BRUSH}
								value={canvas.brush}
								onChange={(e) => canvas.setBrush(Number(e.target.value))}
								className="w-[180px] accent-brand"
							/>
						</label>

						<div className="mt-4 w-full">
							<ShapeCanvas
								canvasRef={canvas.canvasRef}
								redraw={canvas.redraw}
								handlers={canvas.handlers}
								drawable
							/>
						</div>

						<div className="mt-4 flex flex-wrap items-center justify-center gap-3">
							<button
								type="button"
								onClick={canvas.undo}
								disabled={!canvas.canUndo}
								className="h-9 rounded-full border border-black/15 bg-white px-4 text-[13px] font-semibold text-black/70 transition hover:bg-black/5 disabled:opacity-40">
								되돌리기
							</button>
							<button
								type="button"
								onClick={canvas.clear}
								disabled={!canvas.canUndo}
								className="h-9 rounded-full border border-black/15 bg-white px-4 text-[13px] font-semibold text-black/70 transition hover:bg-black/5 disabled:opacity-40">
								지우기
							</button>
						</div>

						<div className="mt-5 flex gap-4">
							<ActionButton
								variant="outline"
								onClick={() => reloadInputRef.current?.click()}>
								<ReloadIcon />
								다시 올리기
							</ActionButton>
							<ActionButton
								onClick={runSearch}
								disabled={searchMutation.isPending}>
								{searchMutation.isPending ? "찾는 중…" : "도안 찾기"}
							</ActionButton>
						</div>

						{showEmptyStrokeHint && (
							<p className="mt-4 text-[14px] text-brand">
								가릴 부위를 그려주세요.
							</p>
						)}
						{hasEmptyResult && (
							<p className="mt-4 text-[14px] font-light text-black/60">
								조건에 맞는 도안이 없습니다. 형태를 조금 바꿔서 다시
								찾아보세요.
							</p>
						)}
						{errorInfo && (
							<div className="mt-4 flex flex-col items-center gap-2">
								<p className="text-[14px] text-brand">{errorInfo.message}</p>
								{errorInfo.retryable && (
									<ActionButton variant="outline" onClick={runSearch}>
										다시 시도
									</ActionButton>
								)}
								{errorInfo.needsLogin && (
									<ActionButton
										variant="outline"
										onClick={() => requireAuth()}>
										로그인하기
									</ActionButton>
								)}
							</div>
						)}
					</>
				)}

				{step === 3 && results.length > 0 && (
					<>
						<StepHeader
							step={3}
							description="닮은 도안을 찾았어요! 마음에 드는 도안을 저장해보세요."
						/>

						<div className="mt-5 w-full">
							<ResultsGrid
								results={results}
								selectedIndex={selectedIndex}
								onSelect={setSelectedIndex}
								onZoom={() => setViewerOpen(true)}
								isStale={isStale}
								onStale={() => setStale(true)}
								onRefresh={runSearch}
								isRefreshing={searchMutation.isPending}
							/>
						</div>

						<div className="mt-5 flex gap-4">
							<ActionButton variant="outline" onClick={() => setStep(2)}>
								<ReloadIcon />
								다시 그리기
							</ActionButton>
							<ActionButton
								onClick={handleSave}
								disabled={saveMutation.isPending || !selectedResult}>
								{saveMutation.isPending ? "저장 중…" : "도안 저장하기"}
							</ActionButton>
						</div>
						{saveMutation.isError && (
							<p className="mt-4 text-[14px] text-brand">
								{saveMutation.error.message}
							</p>
						)}

						<button
							type="button"
							onClick={handleReset}
							className="mt-4 text-[14px] font-light text-black/50 underline underline-offset-4 transition hover:text-black">
							처음부터 다시 하기
						</button>
					</>
				)}
			</div>

			<input
				ref={reloadInputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={handleReloadChange}
			/>

			{selectedResult && (
				<ImageViewerModal
					src={selectedResult.imageUrl}
					alt="추천 커버업 도안"
					isOpen={isViewerOpen}
					onClose={() => setViewerOpen(false)}
				/>
			)}

			<ConfirmModal
				title="저장되었습니다"
				isOpen={isSavedOpen}
				onClose={() => setSavedOpen(false)}
				cancelText="보관함 가기"
				confirmText="시뮬레이션 보기"
				// TODO: 보관함(마이페이지) 라우트 생기면 경로 교체
				onCancel={() => navigate("/")}
				onConfirm={() => navigate("/simulations")}
			/>
		</div>
	);
}
