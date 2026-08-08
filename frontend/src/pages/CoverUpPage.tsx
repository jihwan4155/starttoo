import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import ActionButton from "../components/common/ActionButton";
import ArchiveFullModal from "../components/common/ArchiveFullModal";
import ConfirmModal from "../components/common/ConfirmModal";
import ImageViewerModal from "../components/common/ImageViewerModal";
import BrushSizeSlider from "../components/coverup/BrushSizeSlider";
import ResultsGrid from "../components/coverup/ResultsGrid";
import ShapeCanvas from "../components/coverup/ShapeCanvas";
import StepHeader from "../components/coverup/StepHeader";
import UploadBox from "../components/coverup/UploadBox";
import useCanvasStrokes from "../components/coverup/useCanvasStrokes";
import { describeSearchError } from "../components/coverup/shapeSearchError";
import {
	DEFAULT_MODE,
	MODES,
} from "../components/coverup/shapeSearchConstants";
import Simulation3DStep from "../components/simulation/Simulation3DStep";
import { useBodyScan } from "../components/simulation/useBodyScan";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../constants/upload";
import useShapeSearchMutation from "../hooks/mutations/useShapeSearch";
import useArchiveCapacity from "../hooks/queries/useArchiveCapacity";
import useRequireAuth from "../hooks/useRequireAuth";
import { saveToArchive } from "../services/archiveApi";
import type {
	CoverupRouteState,
	SearchMode,
} from "../types/shapeSearch";
import { useIsMobile } from "../hooks/useIsMobile";
import MobileCoverUpFlow from "../components/coverup/MobileCoverUpFlow";
import LoadingLabel from "../components/loader/LoadingLabel";
import useSimulationHandoff from "../store/useSimulationHandoff";

type Step = 1 | 2 | 3 | 4;

const STEP_DESCRIPTION: Record<Step, string> = {
	1: "커버업하고 싶은 흉터나 타투가 있는 부위의 사진을 올려주세요",
	2: "가릴 부위를 따라 그려주세요",
	3: "그린 형태를 닮은 도안이에요. 저장하거나 내 몸에 시뮬레이션해보세요",
	4: "타투를 배치하고 완성된 결과를 확인하세요",
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
	const location = useLocation();
	const isMobile = useIsMobile();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { requireAuth } = useRequireAuth();
	const startSimulation = useSimulationHandoff((state) => state.start);
	const routeState = location.state as CoverupRouteState | null;
	const isDoodleSearch =
		routeState?.source === "doodle" &&
		Boolean(routeState.doodleMaskPngB64) &&
		(routeState.doodleResults?.length ?? 0) > 0;

	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [fileError, setFileError] = useState<string | null>(null);
	const [mode, setMode] = useState<SearchMode>(DEFAULT_MODE);
	// 획 없이 검색을 누른 경우. 요청은 보내지 않고 안내만 띄운다
	const [showEmptyStrokeHint, setShowEmptyStrokeHint] = useState(false);
	const [isStale, setStale] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isViewerOpen, setViewerOpen] = useState(false);
	const [isSavedOpen, setSavedOpen] = useState(false);
	const [showArchiveFull, setShowArchiveFull] = useState(false);

	const canvas = useCanvasStrokes(mode);
	const searchMutation = useShapeSearchMutation();
	const saveMutation = useMutation({ mutationFn: saveToArchive });
	const { isFull, hasTattoo } = useArchiveCapacity();

	const results =
		searchMutation.data ??
		(isDoodleSearch ? (routeState?.doodleResults ?? []) : []);

	/*
	 * 단계를 router history에 싣는다.
	 *
	 * state로만 들고 있으면 히스토리 항목이 쌓이지 않아 브라우저 뒤로가기가 이 페이지를
	 * 통째로 떠나 버린다(직전에 보던 화면으로 튄다). 단계마다 항목을 남겨 두면
	 * 뒤로가기가 이전 커버업 단계로 돌아간다.
	 *
	 * 재료(사진·검색 결과)는 메모리에만 있는데 history.state는 새로고침 후에도 남으므로,
	 * 실제로 도달 가능한 단계까지만 인정해 STEP 4로 복원되며 빈 화면이 뜨는 것을 막는다.
	 */
	const historyStep = routeState?.coverupStep;
	const maxStep: Step = isDoodleSearch
		? results.length > 0
			? 3
			: 1
		: !previewUrl
			? 1
			: results.length === 0
				? 2
				: 4;
	const step = Math.min(Math.max(historyStep ?? 1, 1), maxStep) as Step;

	const goToStep = (next: Step) => {
		const nextState: CoverupRouteState = isDoodleSearch
			? { ...(routeState ?? {}), coverupStep: next }
			: { coverupStep: next };
		navigate(location.pathname, { state: nextState });
	};

	// 잘려 나간 단계는 히스토리에서도 지운다. 그대로 두면 사진을 다시 올리는 순간
	// 남아 있던 값(예: 4)이 되살아나 "다음"을 누르지 않았는데 다음 단계로 튄다.
	useEffect(() => {
		if (historyStep != null && historyStep > step) {
			navigate(location.pathname, {
				state: isDoodleSearch
					? { ...(routeState ?? {}), coverupStep: step }
					: { coverupStep: step },
				replace: true,
			});
		}
	}, [
		historyStep,
		step,
		navigate,
		location.pathname,
		isDoodleSearch,
		routeState,
	]);

	// 사진을 고르고 그리기 단계로 넘어가는 동안 인물 분할·3D 굴곡 모델을 미리 돌려 둔다.
	// 도안을 고를 때쯤 끝나 있어서 "시뮬레이션 해보기"가 곧바로 결과로 이어진다.
	const bodyScan = useBodyScan(previewUrl, !isDoodleSearch && step >= 2);

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

	/**
	 * 모드를 바꾸면 기존 결과를 비운다. 붓 굵기는 useCanvasStrokes가 그 모드의
	 * 기준값으로 되돌린다.
	 *
	 * <p>지금은 모드 토글 UI가 없어 호출되지 않지만, 면 모드를 되살릴 때 그대로
	 * 쓰도록 남겨 둔다(shapeSearchConstants의 DEFAULT_MODE 주석 참고).
	 */
	const switchMode = (next: SearchMode) => {
		if (next === mode) return;
		setMode(next);
		searchMutation.reset();
		setStale(false);
		setShowEmptyStrokeHint(false);
	};

	const runSearch = () => {
		const maskPngB64 = isDoodleSearch
			? routeState?.doodleMaskPngB64
			: canvas.buildMask();
		if (!maskPngB64) {
			setShowEmptyStrokeHint(true);
			return;
		}
		setShowEmptyStrokeHint(false);
		setStale(false);
		searchMutation.mutate(
			{ maskPngB64, mode: isDoodleSearch ? "shape" : mode },
			{
				onSuccess: (nextResults) => {
					setSelectedIndex(0);
					// 결과가 없으면 그림을 바로 고칠 수 있게 STEP 2에 머문다
					if (nextResults.length > 0) goToStep(3);
				},
			},
		);
	};

	/**
	 * 고른 도안을 이 페이지 안에서 바로 시뮬레이션한다.
	 *
	 * <p>시뮬레이션 페이지로 넘기지 않는 이유는 도안을 다시 고르려면 되돌아와
	 * 사진 업로드부터 다시 해야 하기 때문이다. STEP 4로만 이동하면 "이전"으로
	 * 결과 목록에 돌아가 다른 도안을 바로 시뮬레이션할 수 있다.
	 */
	const goToSimulation = () => {
		if (!selectedResult) return;
		requireAuth(() => {
			if (isDoodleSearch) {
				startSimulation({
					bodyPhoto: null,
					designUrl: selectedResult.imageUrl,
					scan: null,
				});
				navigate("/simulations");
				return;
			}
			if (!previewUrl) return;
			goToStep(4);
		});
	};

	const handleSave = () => {
		if (!selectedResult) return;
		requireAuth(() => {
			if (isFull && !hasTattoo(selectedResult.tattooSeq)) {
				setShowArchiveFull(true);
				return;
			}
			// 서버가 돌려주는 saved 값은 ApiResponse 봉투에 싸여 있어 아직 신뢰할 수 없다.
			// 예외 없이 끝나면 저장된 것으로 본다. (전역 언랩 작업에서 정리)
			saveMutation.mutate(selectedResult.tattooSeq, {
				onSuccess: () => setSavedOpen(true),
			});
		});
	};

	const canAdvance = step === 1 ? Boolean(previewUrl) : true;
	// 화면의 "이전"과 브라우저 뒤로가기가 같은 동작이 되도록 히스토리를 되감는다
	const handleBack = () => navigate(-1);

	// 오른쪽 화살표 자리의 동작이 단계마다 다르다: STEP1 다음 / STEP2 검색
	const handleForward = () => {
		if (step === 1) {
			if (canAdvance) goToStep(2);
			return;
		}
		if (step === 2) runSearch();
	};

	const forwardLabel = step === 2 ? "도안 찾기" : "다음";
	const forwardEnabled =
		step === 1 ? canAdvance : !searchMutation.isPending && step === 2;
	const mobileSearchMessage = showEmptyStrokeHint
		? "가릴 부위를 그려주세요."
		: hasEmptyResult
			? "조건에 맞는 도안이 없습니다. 영역을 조금 바꿔 다시 시도해주세요."
			: (errorInfo?.message ?? null);
	// 오류가 아니라 그리기 안내라, 빨간 searchMessage와 자리를 나눈다
	const openShapeHint = canvas.hasOpenShape
		? "시작점까지 이어 그리면 안쪽까지 덮어요."
		: null;

	if (isMobile) {
		return (
			<>
				<MobileCoverUpFlow
					title={isDoodleSearch ? "타투 도안 추천" : "커버업 타투 도안 추천"}
					step={step}
					mode={mode}
					onModeChange={switchMode}
					brush={canvas.brush}
					onBrushChange={canvas.setBrush}
					bodyScan={bodyScan}
					fileInputRef={fileInputRef}
					previewUrl={previewUrl}
					fileError={fileError}
					onSelectFile={handleSelectFile}
					onPickFile={() => fileInputRef.current?.click()}
					canvasProps={{
						canvasRef: canvas.canvasRef,
						redraw: canvas.redraw,
						handlers: canvas.handlers,
					}}
					canUndo={canvas.canUndo}
					onUndo={canvas.undo}
					onClear={canvas.clear}
					onBack={() => step === 1 ? navigate(-1) : handleBack()}
					onNext={handleForward}
					nextDisabled={!forwardEnabled}
					isSearching={searchMutation.isPending}
					searchMessage={mobileSearchMessage}
					openShapeHint={openShapeHint}
					results={results}
					selectedIndex={selectedIndex}
					onSelectResult={setSelectedIndex}
					onSave={handleSave}
					onSimulate={goToSimulation}
					isSaving={saveMutation.isPending}
					saveError={saveMutation.isError ? saveMutation.error.message : null}
					isSavedOpen={isSavedOpen}
					onCloseSaved={() => setSavedOpen(false)}
				/>
				<ArchiveFullModal
					isOpen={showArchiveFull}
					onClose={() => setShowArchiveFull(false)}
				/>
			</>
		);
	}

	return (
		<div className="h-[calc(100vh-var(--nav-h))] overflow-hidden bg-surface">
			<div className="mx-auto flex h-full w-full max-w-[1020px] flex-col px-6 pb-6 pt-6">
				{/* 기능명세 4-1: 서비스 소개 섹션.
				    시뮬레이션 단계에서는 캔버스에 높이를 넘겨주려고 접는다 */}
				{step !== 4 && (
					<h1 className="shrink-0 text-center text-[26px] font-extrabold text-black">
						{isDoodleSearch ? "타투 도안 추천" : "커버업 타투 도안 추천"}
					</h1>
				)}

				<StepHeader description={STEP_DESCRIPTION[step]} />

				{/* 펜 굵기 — 예전 모드 토글이 있던 자리. 그리기 전에 먼저 정하도록 캔버스 위에 둔다 */}
				{step === 2 && (
					<div className="mt-3 shrink-0">
						<BrushSizeSlider value={canvas.brush} onChange={canvas.setBrush} />
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
						{/* 시뮬레이션도 이 페이지 안에서 끝낸다 — "이전"으로 도안을 다시 고를 수 있게 */}
						{step === 4 && (
							<Simulation3DStep
								designUrl={selectedResult?.imageUrl ?? null}
								scan={bodyScan}
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
						} ${step >= 3 ? "invisible" : ""}`}>
						<span className="hidden sm:inline">
							{searchMutation.isPending && step === 2 ? (
								<LoadingLabel>찾는 중…</LoadingLabel>
							) : (
								forwardLabel
							)}
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
									기기에서 선택
								</ActionButton>
							</div>
							{/* 안내가 아니라 오류만 남긴다. 자리는 비워 둬 버튼이 흔들리지 않게 한다 */}
							<p className="mt-2 text-center text-[13px] text-brand">
								{fileError ?? " "}
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
								{!showEmptyStrokeHint &&
									!hasEmptyResult &&
									!errorInfo &&
									(canvas.hasOpenShape ? (
										<p className="text-[13px] font-light text-black/60">
											시작점까지 이어 그리면 안쪽까지 덮어요.
										</p>
									) : (
										<p className="text-[13px] font-light text-black/50">
											{MODES[mode].hint}
										</p>
									))}
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
									{saveMutation.isPending ? <LoadingLabel>저장 중…</LoadingLabel> : "도안보관함에 저장"}
								</ActionButton>
								<ActionButton
									onClick={goToSimulation}
									disabled={
										!selectedResult || (!isDoodleSearch && !previewUrl)
									}>
									시뮬레이션 해보기
								</ActionButton>
							</div>
							<p className="mt-2 text-center text-[13px] font-light text-black/50">
								{saveMutation.isError ? (
									<span className="text-brand">
										{saveMutation.error.message}
									</span>
								) : (
									/* 스캔이 아직이면 시뮬레이션 진입 후 잠깐 기다린다는 것을 미리 알린다 */
									bodyScan.status === "loading" && <span>신체 분석 중…</span>
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
				cancelText="도안 보관함 가기"
				confirmText="시뮬레이션 보기"
				// TODO: 도안 보관함(마이페이지) 라우트 생기면 경로 교체
				onCancel={() => navigate("/")}
				// 저장 후 바로 넘어가는 경로도 같은 STEP 4로 들어간다
				onConfirm={() => {
					setSavedOpen(false);
					goToSimulation();
				}}
			/>

			<ArchiveFullModal
				isOpen={showArchiveFull}
				onClose={() => setShowArchiveFull(false)}
			/>
		</div>
	);
}
