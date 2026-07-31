import { useState, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";
import SimulationTabs, {
	type SimulationTab,
} from "../components/simulation/SimulationTabs";
import StepHeading from "../components/simulation/StepHeading";
import MarkerGuideStep from "../components/simulation/MarkerGuideStep";
import CameraConnectStep from "../components/simulation/CameraConnectStep";
import ArResultStep from "../components/simulation/ArResultStep";
import ArCustomizeScreen from "../components/simulation/ArCustomizeScreen";
import UploadDropzoneBox from "../components/simulation/UploadDropzoneBox";
import UploadDropzoneActions from "../components/simulation/UploadDropzoneActions";
import { useImageUpload } from "../components/simulation/useImageUpload";
import Simulation3DStep from "../components/simulation/Simulation3DStep";
import MyDesignsModal from "../components/simulation/MyDesignsModal";
import { useBodyScan } from "../components/simulation/useBodyScan";
import { useIsMobile } from "../hooks/useIsMobile";

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

const STEP_COPY: Record<SimulationTab, Record<number, string>> = {
	ar: {
		1: "팔에 인식용 마커를 그려주세요",
		2: "스마트폰으로 카메라를 연결하세요",
		3: "폰에서 캡처한 결과를 확인하고 저장하세요",
	},
	image: {
		1: "시착해 볼 신체 사진을 선택하세요",
		2: "원하는 이미지 도안을 올려주세요",
		3: "타투를 배치하고 완성된 결과를 확인하세요",
	},
};

const MAX_STEP: Record<SimulationTab, number> = { ar: 3, image: 3 };

export default function SimulationsPage() {
	const [searchParams] = useSearchParams();
	// QR/링크로 ?mode=ar 진입 시 실시간(AR) 탭을 바로 선택
	const [tab, setTab] = useState<SimulationTab>(
		searchParams.get("mode") === "ar" ? "ar" : "image"
	);
	const [arStep, setArStep] = useState(1);
	const [imageStep, setImageStep] = useState(1);
	const [myDesignsOpen, setMyDesignsOpen] = useState(false);
	const [captureUrl, setCaptureUrl] = useState<string | null>(null);
	const isMobile = useIsMobile();

	const designUpload = useImageUpload();
	const bodyPhotoUpload = useImageUpload();

	const step = tab === "ar" ? arStep : imageStep;
	const setStep: Dispatch<SetStateAction<number>> =
		tab === "ar" ? setArStep : setImageStep;
	const maxStep = MAX_STEP[tab];
	// 변경: 이미지(3D)는 각 입력이 완료된 뒤에만 다음 단계로 이동한다.
	// STEP1 신체 사진 → STEP2 도안 순서.
	const canAdvance =
		tab !== "image" ||
		(step === 1 && Boolean(bodyPhotoUpload.preview)) ||
		(step === 2 && Boolean(designUpload.preview));

	// 신체 사진 선택 후 도안을 고르는 동안(STEP2~) 백그라운드에서
	// 인물 마스크·3D 굴곡을 미리 스캔한다.
	const bodyScan = useBodyScan(
		bodyPhotoUpload.preview,
		tab === "image" && imageStep >= 2,
	);

	const handleNext = () => {
		if (!canAdvance) return;
		setStep((current) => Math.min(maxStep, current + 1));
	};
	const handleBack = () => setStep((current) => Math.max(1, current - 1));

	// 모바일 AR 커스텀 단계 — QR 없이 폰에서 직접 카메라+합성+캡처
	const mobileArLive = isMobile && tab === "ar" && step === 3;

	// AR 단계 설명 (모바일은 QR 없이 직접 카메라)
	const mobileArCopy: Record<number, string> = {
		1: "팔에 인식용 마커를 그려주세요",
		2: "카메라를 연결하세요",
		3: "실시간으로 확인하고 저장하세요",
	};
	const stepDescription =
		tab === "ar" && isMobile ? mobileArCopy[step] : STEP_COPY[tab][step];

	// 이미지(3D) 마지막 단계·모바일 AR 라이브에서는 상단을 숨겨 화면에 집중
	const hideHeader = (tab === "image" && step === maxStep) || mobileArLive;

	return (
		<div className="h-[calc(100vh-60px)] overflow-hidden bg-surface">
			<div className="mx-auto flex h-full w-full max-w-[1020px] flex-col px-6 pt-6 pb-6">
				{!hideHeader && (
					<>
						<p className="shrink-0 text-center text-[13px] font-light text-black/60">
							상상만 하던 타투, 이제 눈으로 확인해보세요
						</p>
						<h1 className="mt-1 shrink-0 text-center text-[26px] font-extrabold text-black">
							타투 시뮬레이션
						</h1>

						<div className="mt-4 shrink-0">
							<SimulationTabs active={tab} onChange={setTab} />
						</div>
					</>
				)}

				{!mobileArLive && (
					<StepHeading step={step} description={stepDescription} />
				)}

				{mobileArLive ? (
					/* 모바일 AR 라이브 — 전체 폭, 화살표 없이 (도안+옵션+캡처) */
					<div className="mt-3 flex min-h-0 flex-1 flex-col">
						<button
							type="button"
							onClick={() => setArStep(2)}
							className="mb-2 flex shrink-0 items-center gap-1 self-start text-[15px] font-semibold text-black/40">
							<ChevronLeftIcon />
							이전
						</button>
						<div className="flex min-h-0 flex-1 justify-center overflow-y-auto">
							<ArCustomizeScreen onCapture={setCaptureUrl} />
						</div>
					</div>
				) : (
					/* grid-rows-[minmax(0,1fr)]: 행이 콘텐츠 크기로 늘어나 STEP 문구를 덮지 않게 가용 높이로 고정 */
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

						<div className="flex min-w-0 min-h-0 items-center justify-center">
							{tab === "ar" && step === 1 && <MarkerGuideStep />}
							{tab === "ar" &&
								step === 2 &&
								(isMobile ? (
									<div className="flex flex-col items-center gap-4 text-center">
										<p className="text-[14px] font-light text-black/60">
											준비되면 카메라를 연결하세요
										</p>
										<button
											type="button"
											onClick={() => setArStep(3)}
											className="rounded-full bg-brand px-8 py-3 text-[16px] font-semibold text-white transition hover:brightness-95">
											카메라 연결
										</button>
									</div>
								) : (
									<CameraConnectStep />
								))}
							{tab === "ar" && step === 3 && (
								<ArResultStep onRestart={() => setArStep(1)} />
							)}

							<UploadDropzoneBox
								visible={tab === "image" && step === 1}
								inputRef={bodyPhotoUpload.inputRef}
								preview={bodyPhotoUpload.preview}
								onPick={bodyPhotoUpload.openPicker}
								onChange={bodyPhotoUpload.handleChange}
								onDrop={bodyPhotoUpload.handleDrop}
							/>
							<UploadDropzoneBox
								visible={tab === "image" && step === 2}
								inputRef={designUpload.inputRef}
								preview={designUpload.preview}
								onPick={designUpload.openPicker}
								onChange={designUpload.handleChange}
								onDrop={designUpload.handleDrop}
							/>
							{/* 3D 시뮬레이션: 백그라운드 스캔 결과로 도안 배치·저장을 한 화면에서 */}
							{tab === "image" && step === 3 && (
								<Simulation3DStep
									designUrl={designUpload.preview}
									scan={bodyScan}
								/>
							)}
						</div>

						<button
							type="button"
							onClick={handleNext}
							disabled={!canAdvance}
							aria-label="다음"
							className={`flex items-center justify-self-start gap-1.5 whitespace-nowrap text-[19px] font-extrabold transition ${
								canAdvance
									? "text-brand hover:brightness-90"
									: "cursor-not-allowed text-black/20"
							} ${step === maxStep ? "invisible" : ""}`}>
							<span className="hidden sm:inline">다음</span>
							<ChevronRightIcon />
						</button>
					</div>
				)}

				{tab === "ar" && step === 1 && (
					<p className="mt-2 shrink-0 text-center text-[13px] font-light text-black/50">
						마커를 진하게 그릴수록 AR 인식률이 높아져요!
					</p>
				)}

				{tab === "ar" && step === 2 && !isMobile && (
					<p className="mt-2 shrink-0 text-center text-[14px] font-light leading-5 text-black/50">
						기본 카메라 앱으로 QR코드를 비추면
						<br />
						즉시 내 피부에 시뮬레이션할 수 있습니다.
					</p>
				)}

				{tab === "image" && step === 1 && (
					<UploadDropzoneActions
						onPick={bodyPhotoUpload.openPicker}
						hint="내 사진을 사용하면 실제로 내 피부에 어떻게 보일지 확인할 수 있어요"
					/>
				)}
				{tab === "image" && step === 2 && (
					<UploadDropzoneActions
						showLibraryButton
						onPick={designUpload.openPicker}
						onPickLibrary={() => setMyDesignsOpen(true)}
					/>
				)}
			</div>

			{myDesignsOpen && (
				<MyDesignsModal
					onClose={() => setMyDesignsOpen(false)}
					onSelect={(design) => {
						// 보관함에서 고른 도안을 시뮬레이션 도안으로 사용
						designUpload.setFromUrl(design.previewUrl);
						setMyDesignsOpen(false);
					}}
				/>
			)}

			{/* 모바일 캡처 결과 — 미리보기 + 기기 저장 */}
			{captureUrl && (
				<div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-neutral-950/95 px-6 text-center backdrop-blur">
					<div className="w-56 overflow-hidden rounded-[16px] ring-1 ring-white/15">
						<img
							src={captureUrl}
							alt="캡처 결과"
							className="w-full object-cover"
						/>
					</div>
					<div>
						<p className="text-[18px] font-bold text-white">캡처 완료!</p>
						<p className="mt-1 text-[14px] font-light text-white/60">
							이미지를 기기에 저장하세요.
						</p>
					</div>
					<div className="flex flex-col items-center gap-3">
						<a
							href={captureUrl}
							download="starttoo-tattoo.png"
							className="rounded-full bg-brand px-8 py-3 text-[16px] font-semibold text-white transition hover:brightness-95">
							기기에 저장
						</a>
						<button
							type="button"
							onClick={() => setCaptureUrl(null)}
							className="text-[14px] font-semibold text-white/60">
							다시 촬영하기
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
