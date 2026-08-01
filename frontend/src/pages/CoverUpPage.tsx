import { useEffect, useRef, useState } from "react";
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
	MODE_KEYS,
	MODES,
} from "../components/coverup/shapeSearchConstants";
import { useBodyScan } from "../components/simulation/useBodyScan";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../constants/upload";
import useShapeSearchMutation from "../hooks/mutations/useShapeSearch";
import useRequireAuth from "../hooks/useRequireAuth";
import { saveToArchive } from "../services/archiveApi";
import useSimulationHandoff from "../store/useSimulationHandoff";
import type { SearchMode } from "../types/shapeSearch";

type Step = 1 | 2 | 3;

const STEP_DESCRIPTION: Record<Step, string> = {
	1: "커버업하고 싶은 흉터나 타투가 있는 부위의 사진을 올려주세요",
	2: "가릴 부위를 따라 그려주세요",
	3: "그린 형태를 닮은 도안이에요. 저장하거나 내 몸에 시뮬레이션해보세요",
};

function ChevronLeftIcon() {
	return (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
			<path
				d="M15 6l-6 6 6 6"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function ChevronRightIcon() {
	return (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
			<path
				d="M9 6l6 6-6 6"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export default function CoverUpPage() {
	const navigate = useNavigate();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { requireAuth } = useRequireAuth();

	const [step, setStep] = useState<Step>(1);
	// 시뮬레이션으로 넘길 때 blob URL은 이 페이지가 언마운트되며 해제되므로 원본 File을 들고 있는다
	const [bodyFile, setBodyFile] = useState<File | null>(null);
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
	const startHandoff = useSimulationHandoff((s) => s.start);

	// 사진을 고르고 그리기 단계로 넘어가는 동안 인물 분할·3D 굴곡 모델을 미리 돌려 둔다.
	// 도안을 고를 때쯤 끝나 있어서 "시뮬레이션 해보기"가 곧바로 결과로 이어진다.
	const bodyScan = useBodyScan(previewUrl, step >= 2);

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
		setBodyFile(nextFile);
		setPreviewUrl(nextUrl);
		canvas.loadPhoto(nextUrl);
		canvas.clear();
		searchMutation.reset();
		setStale(false);
		setShowEmptyStrokeHint(false);
	};

	/** 모드를 바꾸면 기존 결과를 비운다 (붓 굵기는 모드와 무관하게 고정) */
	const switchMode = (next: SearchMode) => {
		if (next === mode) return;
		setMode(next);
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
		setBodyFile(null);
		setPreviewUrl(null);
		setFileError(null);
		setMode(DEFAULT_MODE);
		canvas.loadPhoto(null);
		canvas.clear();
		searchMutation.reset();
		saveMutation.reset();
		setStale(false);
		setShowEmptyStrokeHint(false);
		setSelectedIndex(0);
	};

	/**
	 * 고른 도안을 들고 시뮬레이션 페이지로 넘어간다.
	 *
	 * <p>미리 끝난 스캔이 있으면 함께 넘겨 곧바로 3D 단계로 들어가게 한다. 아직
	 * 진행 중이면 넘기지 않는다 — 이 페이지가 언마운트되면 그 스캔은 더 갱신되지
	 * 않아 로딩 화면에서 멈추기 때문이다. (모델은 이미 로드돼 있어 다시 돌려도 빠르다)
	 */
	const goToSimulation = () => {
		if (!bodyFile || !selectedResult) return;
		startHandoff({
			bodyPhoto: bodyFile,
			designUrl: selectedResult.imageUrl,
			scan: bodyScan.status === "ready" ? bodyScan : null,
		});
		navigate("/simulations");
	};

	const handleSave = () => {
		if (!selectedResult) return;
		// 서버가 돌려주는 saved 값은 ApiResponse 봉투에 싸여 있어 아직 신뢰할 수 없다.
		// 예외 없이 끝나면 저장된 것으로 본다. (전역 언랩 작업에서 정리)
		saveMutation.mutate(selectedResult.tattooSeq, {
			onSuccess: () => setSavedOpen(true),
		});
	};

	const canAdvance = step === 1 ? Boolean(previewUrl) : true;
	const handleBack = () => setStep((current) => (current === 3 ? 2 : 1));

	// 오른쪽 화살표 자리의 동작이 단계마다 다르다: STEP1 다음 / STEP2 검색
	const handleForward = () => {
		if (step === 1) {
			if (canAdvance) setStep(2);
			return;
		}
		if (step === 2) runSearch();
	};

	const forwardLabel = step === 2 ? "도안 찾기" : "다음";
	const forwardEnabled =
		step === 1 ? canAdvance : !searchMutation.isPending && step === 2;

	return (
		<div className="h-[calc(100vh-60px)] overflow-hidden bg-surface">
			<div className="mx-auto flex h-full w-full max-w-[1020px] flex-col px-6 pb-6 pt-6">
				{/* 기능명세 4-1: 서비스 소개 섹션 */}
				<p className="shrink-0 text-center text-[13px] font-light text-black/60">
					흉터도, 오래된 타투도 새롭게
				</p>
				<h1 className="mt-1 shrink-0 text-center text-[26px] font-extrabold text-black">
					커버업 타투 도안 추천
				</h1>

				<StepHeader description={STEP_DESCRIPTION[step]} />

				{/* 모드 토글 — 그리기 전에 무엇을 그릴지 먼저 고르도록 캔버스 위에 둔다 */}
				{step === 2 && (
					<div className="mx-auto mt-3 flex h-[40px] w-full max-w-[240px] shrink-0 items-center rounded-[12px] bg-white p-1 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
						{MODE_KEYS.map((key) => (
							<button
								key={key}
								type="button"
								onClick={() => switchMode(key)}
								className={`h-full flex-1 rounded-[9px] text-[14px] font-semibold transition ${
									mode === key ? "bg-surface text-black" : "text-black/40"
								}`}>
								{MODES[key].label}
							</button>
						))}
					</div>
				)}

				{/* grid-rows-[minmax(0,1fr)]: 행이 콘텐츠 크기로 늘어나 안내 문구를 덮지
				    않도록 가용 높이로 고정한다. 좌우 열은 이전/다음 화살표 자리 */}
				<div className="mt-4 grid min-h-0 flex-1 grid-cols-[44px_1fr_44px] grid-rows-[minmax(0,1fr)] gap-2 sm:grid-cols-[100px_1fr_100px] sm:gap-6">
					<button
						type="button"
						onClick={handleBack}
						aria-label="이전"
						className={`flex items-center justify-self-end gap-1.5 whitespace-nowrap text-[19px] font-semibold text-black/40 transition hover:text-black/60 ${
							step === 1 ? "invisible" : ""
						}`}>
						<ChevronLeftIcon />
						<span className="hidden sm:inline">이전</span>
					</button>

					<div className="flex min-h-0 min-w-0 items-center justify-center">
						{step === 1 && (
							<UploadBox
								inputRef={fileInputRef}
								preview={previewUrl}
								onPick={() => fileInputRef.current?.click()}
								onSelect={handleSelectFile}
							/>
						)}
						{step === 2 && (
							<ShapeCanvas
								canvasRef={canvas.canvasRef}
								redraw={canvas.redraw}
								handlers={canvas.handlers}
							/>
						)}
						{step === 3 && results.length > 0 && (
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
						)}
					</div>

					<button
						type="button"
						onClick={handleForward}
						disabled={!forwardEnabled}
						aria-label={forwardLabel}
						className={`flex items-center justify-self-start gap-1.5 whitespace-nowrap text-[19px] font-extrabold transition ${
							forwardEnabled
								? "text-brand hover:brightness-90"
								: "cursor-not-allowed text-black/20"
						} ${step === 3 ? "invisible" : ""}`}>
						<span className="hidden sm:inline">
							{searchMutation.isPending && step === 2
								? "찾는 중…"
								: forwardLabel}
						</span>
						<ChevronRightIcon />
					</button>
				</div>

				{/* 하단 액션 — 단계마다 다르지만 높이는 비슷하게 유지해 화면이 덜 흔들리게 한다 */}
				<div className="mt-3 shrink-0">
					{step === 1 && (
						<>
							<div className="flex justify-center">
								<ActionButton onClick={() => fileInputRef.current?.click()}>
									컴퓨터에서 선택
								</ActionButton>
							</div>
							<p className="mt-2 text-center text-[13px] font-light text-black/50">
								{fileError ?? "내 사진을 사용하면 실제 피부에 어떻게 보일지 확인할 수 있어요"}
							</p>
						</>
					)}

					{step === 2 && (
						<>
							<div className="flex flex-wrap items-center justify-center gap-2">
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

							<div className="mt-2 flex items-center justify-center gap-3 text-center">
								{showEmptyStrokeHint && (
									<p className="text-[13px] text-brand">
										가릴 부위를 그려주세요.
									</p>
								)}
								{hasEmptyResult && (
									<p className="text-[13px] font-light text-black/60">
										조건에 맞는 도안이 없습니다. 형태를 조금 바꿔서 다시
										찾아보세요.
									</p>
								)}
								{errorInfo && (
									<>
										<p className="text-[13px] text-brand">
											{errorInfo.message}
										</p>
										{errorInfo.retryable && (
											<button
												type="button"
												onClick={runSearch}
												className="h-8 rounded-full border border-black/15 bg-white px-3 text-[13px] font-semibold text-black/70 transition hover:bg-black/5">
												다시 시도
											</button>
										)}
										{errorInfo.needsLogin && (
											<button
												type="button"
												onClick={() => requireAuth()}
												className="h-8 rounded-full border border-black/15 bg-white px-3 text-[13px] font-semibold text-black/70 transition hover:bg-black/5">
												로그인하기
											</button>
										)}
									</>
								)}
								{!showEmptyStrokeHint && !hasEmptyResult && !errorInfo && (
									<p className="text-[13px] font-light text-black/50">
										{MODES[mode].hint}
									</p>
								)}
							</div>
						</>
					)}

					{step === 3 && (
						<>
							<div className="flex flex-wrap justify-center gap-3">
								<ActionButton
									variant="outline"
									onClick={handleSave}
									disabled={saveMutation.isPending || !selectedResult}>
									{saveMutation.isPending ? "저장 중…" : "도안 저장하기"}
								</ActionButton>
								<ActionButton
									onClick={goToSimulation}
									disabled={!bodyFile || !selectedResult}>
									시뮬레이션 해보기
								</ActionButton>
							</div>
							<p className="mt-2 text-center text-[13px] font-light text-black/50">
								{saveMutation.isError ? (
									<span className="text-brand">
										{saveMutation.error.message}
									</span>
								) : (
									<>
										{/* 스캔이 아직이면 시뮬레이션 진입 후 잠깐 기다린다는 것을 미리 알린다 */}
										{bodyScan.status === "loading" && (
											<span className="mr-2">신체 분석 중…</span>
										)}
										<button
											type="button"
											onClick={handleReset}
											className="underline underline-offset-4 transition hover:text-black">
											처음부터 다시 하기
										</button>
									</>
								)}
							</p>
						</>
					)}
				</div>
			</div>

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
				// 저장 후 바로 넘어가는 경로도 같은 인계를 태운다
				onConfirm={goToSimulation}
			/>
		</div>
	);
}
