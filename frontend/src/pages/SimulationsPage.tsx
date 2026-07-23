import { useState, type Dispatch, type SetStateAction } from "react";
import SimulationTabs, {
	type SimulationTab,
} from "../components/simulation/SimulationTabs";
import StepHeading from "../components/simulation/StepHeading";
import BodyPartStep, {
	type BodyPart,
} from "../components/simulation/BodyPartStep";
import CameraConnectStep from "../components/simulation/CameraConnectStep";
import DesignSelectStep from "../components/simulation/DesignSelectStep";
import UploadDropzoneBox from "../components/simulation/UploadDropzoneBox";
import UploadDropzoneActions from "../components/simulation/UploadDropzoneActions";
import { useImageUpload } from "../components/simulation/useImageUpload";
import Simulation3DStep from "../components/simulation/Simulation3DStep";
import MyDesignsModal from "../components/simulation/MyDesignsModal";
import PhotoPreviewModal from "../components/simulation/PhotoPreviewModal";

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
		1: "적용해 볼 신체 부위를 선택하세요",
		2: "스마트폰으로 카메라를 연결하세요",
		3: "원하는 타투를 선택하여 확인해보세요",
	},
	image: {
		1: "원하는 이미지 도안을 올려주세요",
		2: "시착해 볼 신체 사진을 선택하세요",
		3: "타투를 배치하고 완성된 결과를 확인하세요",
	},
};

const MAX_STEP: Record<SimulationTab, number> = { ar: 3, image: 3 };

export default function SimulationsPage() {
	const [tab, setTab] = useState<SimulationTab>("image");
	const [arStep, setArStep] = useState(1);
	const [imageStep, setImageStep] = useState(1);
	const [bodyPart, setBodyPart] = useState<BodyPart | null>(null);
	const [designIndex, setDesignIndex] = useState(0);
	const [myDesignsOpen, setMyDesignsOpen] = useState(false);
	const [previewOpen, setPreviewOpen] = useState(false);

	const designUpload = useImageUpload();
	const bodyPhotoUpload = useImageUpload();

	const step = tab === "ar" ? arStep : imageStep;
	const setStep: Dispatch<SetStateAction<number>> =
		tab === "ar" ? setArStep : setImageStep;
	const maxStep = MAX_STEP[tab];

	const handleNext = () => setStep((current) => Math.min(maxStep, current + 1));
	const handleBack = () => setStep((current) => Math.max(1, current - 1));

	return (
		<div className="h-[calc(100vh-60px)] overflow-hidden bg-surface">
			<div className="mx-auto flex h-full w-full max-w-[1020px] flex-col px-6 pt-6 pb-6">
				<p className="shrink-0 text-center text-[13px] font-light text-black/60">
					상상만 하던 타투, 이제 눈으로 확인해보세요
				</p>
				<h1 className="mt-1 shrink-0 text-center text-[26px] font-extrabold text-black">
					타투 시뮬레이션
				</h1>

				<div className="mt-4 shrink-0">
					<SimulationTabs active={tab} onChange={setTab} />
				</div>

				<StepHeading step={step} description={STEP_COPY[tab][step]} />

				{/* grid-rows-[minmax(0,1fr)]: 행이 콘텐츠 크기로 늘어나 STEP 문구를 덮지 않게 가용 높이로 고정 */}
				<div className="mt-4 grid min-h-0 flex-1 grid-cols-[100px_1fr_100px] grid-rows-[minmax(0,1fr)] gap-6">
					<button
						type="button"
						onClick={handleBack}
						aria-label="이전"
						className={`flex items-center justify-self-end gap-1.5 whitespace-nowrap text-[19px] font-semibold text-black/40 transition hover:text-black/60 ${
							step === 1 ? "invisible" : ""
						}`}>
						<ChevronLeftIcon />
						이전
					</button>

					<div className="flex min-w-0 min-h-0 items-center justify-center">
						{tab === "ar" && step === 1 && (
							<BodyPartStep selected={bodyPart} onSelect={setBodyPart} />
						)}
						{tab === "ar" && step === 2 && <CameraConnectStep />}
						{tab === "ar" && step === 3 && (
							<DesignSelectStep
								selectedIndex={designIndex}
								onSelect={setDesignIndex}
								onAddDesign={() => setMyDesignsOpen(true)}
								onCapture={() => setPreviewOpen(true)}
							/>
						)}

						<UploadDropzoneBox
							visible={tab === "image" && step === 1}
							inputRef={designUpload.inputRef}
							preview={designUpload.preview}
							onPick={designUpload.openPicker}
							onChange={designUpload.handleChange}
							onDrop={designUpload.handleDrop}
						/>
						<UploadDropzoneBox
							visible={tab === "image" && step === 2}
							inputRef={bodyPhotoUpload.inputRef}
							preview={bodyPhotoUpload.preview}
							onPick={bodyPhotoUpload.openPicker}
							onChange={bodyPhotoUpload.handleChange}
							onDrop={bodyPhotoUpload.handleDrop}
						/>
						{/* 3D 시뮬레이션: 진입 즉시 AI 파이프라인 실행 → 배치·바램·저장을 한 화면에서 */}
						{tab === "image" && step === 3 && (
							<Simulation3DStep
								designUrl={designUpload.preview}
								photoUrl={bodyPhotoUpload.preview}
							/>
						)}
					</div>

					<button
						type="button"
						onClick={handleNext}
						aria-label="다음"
						className={`flex items-center justify-self-start gap-1.5 whitespace-nowrap text-[19px] font-extrabold text-brand transition hover:brightness-90 ${
							step === maxStep ? "invisible" : ""
						}`}>
						다음
						<ChevronRightIcon />
					</button>
				</div>

				{tab === "ar" && step === 1 && (
					<p className="mt-2 shrink-0 text-center text-[13px] font-light text-black/50">
						부위를 선택하여 AR 인식률을 높이고 있어요!
					</p>
				)}

				{tab === "ar" && step === 2 && (
					<p className="mt-2 shrink-0 text-center text-[14px] font-light leading-5 text-black/50">
						기본 카메라 앱으로 QR코드를 비추면
						<br />
						즉시 내 피부에 시뮬레이션할 수 있습니다.
					</p>
				)}

				{tab === "image" && step === 1 && (
					<UploadDropzoneActions
						showLibraryButton
						onPick={designUpload.openPicker}
					/>
				)}
				{tab === "image" && step === 2 && (
					<UploadDropzoneActions
						onPick={bodyPhotoUpload.openPicker}
						hint="내 사진을 사용하면 실제로 내 피부에 어떻게 보일지 확인할 수 있어요"
					/>
				)}
			</div>

			{myDesignsOpen && (
				<MyDesignsModal onClose={() => setMyDesignsOpen(false)} />
			)}
			{previewOpen && (
				<PhotoPreviewModal
					title="사진 미리보기"
					onClose={() => setPreviewOpen(false)}
				/>
			)}
		</div>
	);
}
