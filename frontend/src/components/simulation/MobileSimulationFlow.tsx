import { useState } from "react";
import simulationCover from "../../assets/images/home/home-simul-after.png";
import type { BodyScanResult } from "./useBodyScan";
import type { useImageUpload } from "./useImageUpload";
import type { SimulationTab } from "./SimulationTabs";
import Simulation3DStep from "./Simulation3DStep";
import MarkerGuideStep from "./MarkerGuideStep";
import ArCustomizeScreen from "./ArCustomizeScreen";
import { CloseIcon, MobileHeader, StepTitle } from "./MobileChrome";

type ImageUpload = ReturnType<typeof useImageUpload>;

type MobileSimulationFlowProps = {
	mode: SimulationTab | null;
	confirmed: boolean;
	imageStep: number;
	arStep: number;
	bodyPhotoUpload: ImageUpload;
	designUpload: ImageUpload;
	bodyScan: BodyScanResult;
	onSelectMode: (mode: SimulationTab) => void;
	onConfirmMode: () => void;
	onBack: () => void;
	onNext: () => void;
	onArNext: () => void;
	onOpenDesigns: () => void;
	captureUrl: string | null;
	onCapture: (dataUrl: string) => void;
	onClearCapture: () => void;
};

function ImageIcon() {
	return <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden><rect x="3" y="4" width="22" height="20" rx="4" stroke="currentColor" strokeWidth="2"/><circle cx="19" cy="10" r="2.5" stroke="currentColor" strokeWidth="2"/><path d="m5.5 21 6.2-6.5 4.1 4 2.8-2.7 4 4.2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>;
}

function BottomButton({ disabled = false, onClick, children }: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
	return <button type="button" disabled={disabled} onClick={onClick} className="fixed inset-x-0 bottom-0 z-40 h-[60px] rounded-t-[10px] bg-brand text-[20px] font-bold text-white transition disabled:cursor-not-allowed disabled:bg-[#D9D9D9] disabled:text-[#666]">{children}</button>;
}

export default function MobileSimulationFlow({
	mode,
	confirmed,
	imageStep,
	arStep,
	bodyPhotoUpload,
	designUpload,
	bodyScan,
	onSelectMode,
	onConfirmMode,
	onBack,
	onNext,
	onArNext,
	onOpenDesigns,
	captureUrl,
	onCapture,
	onClearCapture,
}: MobileSimulationFlowProps) {
	const [savedModalOpen, setSavedModalOpen] = useState(false);
	const [homeConfirmOpen, setHomeConfirmOpen] = useState(false);
	const goHome = () => window.location.assign("/");
	const handleHome = () => confirmed ? setHomeConfirmOpen(true) : goHome();
	const homeConfirmModal = homeConfirmOpen && (
		<div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 px-4" role="presentation" onClick={() => setHomeConfirmOpen(false)}>
			<div className="relative w-full max-w-[344px] rounded-[12px] bg-white px-7 pb-7 pt-10 text-center" role="dialog" aria-modal="true" aria-label="시뮬레이션 종료" onClick={(event) => event.stopPropagation()}>
				<button type="button" aria-label="닫기" onClick={() => setHomeConfirmOpen(false)} className="absolute right-4 top-4 text-[#40505D]"><CloseIcon /></button>
				<h2 className="text-[20px] font-bold">홈으로 이동할까요?</h2>
				<p className="mt-3 text-[14px] leading-5 text-[#777]">진행 중인 시뮬레이션 내용은 사라집니다.</p>
				<div className="mt-7 flex gap-3">
					<button type="button" onClick={() => setHomeConfirmOpen(false)} className="h-11 flex-1 rounded-full bg-[#E2E2E2] text-[15px] font-semibold text-[#555]">계속하기</button>
					<button type="button" onClick={goHome} className="h-11 flex-1 rounded-full bg-brand text-[15px] font-semibold text-white">홈으로 가기</button>
				</div>
			</div>
		</div>
	);

	if (!confirmed) {
		return (
			<div className="min-h-[calc(100vh-var(--nav-h))] bg-surface px-4 pb-24 pt-7">
				<MobileHeader title="타투 시뮬레이션" onHome={handleHome} />
				<div className="mb-6 text-center">
					<h2 className="text-[22px] font-bold">어떻게 미리 볼까요?</h2>
					<p className="mt-2 text-[14px] leading-5 text-[#777]">
						사진에 직접 배치하거나 카메라로 실시간 확인해보세요
					</p>
				</div>
				<div className="space-y-4">
					{(["image", "ar"] as const).map((item) => {
						const selected = mode === item;
						const isImage = item === "image";
						return (
							<button
								key={item}
								type="button"
								onClick={() => onSelectMode(item)}
								aria-pressed={selected}
								className={`relative h-[174px] w-full overflow-hidden rounded-[12px] text-left transition-all ${selected ? "border-[3px] border-brand shadow-[0_8px_24px_rgba(255,76,76,0.18)]" : "border border-[#D0D0D0] shadow-sm"}`}>
								<img src={simulationCover} alt="" className="absolute inset-0 size-full object-cover grayscale" />
								<div className={`absolute inset-0 transition-colors ${selected ? "bg-black/60" : "bg-white/55"}`} />
								<div className={`relative z-10 flex h-full flex-col justify-end p-5 ${selected ? "text-white" : "text-black"}`}>
									<div className="flex items-center">
										<span className="text-[29px] font-extrabold">{isImage ? "이미지(3D)" : "실시간(AR)"}</span>
									</div>
									<p className={`mt-2 text-[13px] font-medium ${selected ? "text-white/80" : "text-black/65"}`}>
										{isImage ? "사진 위에 도안을 자유롭게 배치해요" : "카메라 화면에서 타투를 바로 확인해요"}
									</p>
								</div>
							</button>
						);
					})}
				</div>
				<BottomButton disabled={!mode} onClick={onConfirmMode}>다음</BottomButton>
				{homeConfirmModal}
			</div>
		);
	}

	if (mode === "ar") {
		const isGuideStep = arStep === 1;
		return (
			<>
				<div className="min-h-[calc(100vh-var(--nav-h))] bg-surface px-4 pb-24 pt-8">
					<MobileHeader title="타투 시뮬레이션 - 실시간(AR)" onHome={handleHome} />
					{isGuideStep ? (
						<>
							<StepTitle onBack={onBack} className="mb-6">팔에 인식용 마커를 그려주세요</StepTitle>
							<div className="mx-auto max-w-[560px]"><MarkerGuideStep /></div>
							<p className="mt-8 text-center text-[14px] text-[#555]">마커를 진하게 그릴수록 AR 인식률이 높아져요!</p>
							<BottomButton onClick={onArNext}>다음</BottomButton>
						</>
					) : (
						<div className="mx-auto max-w-[560px]">
							<StepTitle onBack={onBack} className="mb-4">카메라에 마커를 맞춰주세요</StepTitle>
							<ArCustomizeScreen onCapture={onCapture} />
						</div>
					)}
				</div>

				{captureUrl && (
					<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4" role="presentation" onClick={onClearCapture}>
						<div className="relative w-full max-w-[344px] rounded-[12px] bg-white px-8 pb-7 pt-11 text-center" role="dialog" aria-modal="true" aria-label="AR 캡처 완료" onClick={(event) => event.stopPropagation()}>
							<button type="button" aria-label="닫기" onClick={onClearCapture} className="absolute right-4 top-4 text-[#40505D]"><CloseIcon /></button>
							<h2 className="text-[22px] font-bold">캡처 완료</h2>
							<p className="mt-6 text-[17px] leading-6">이미지를 기기에 저장하세요</p>
							<div className="mt-7 flex flex-col items-center gap-4">
								<a href={captureUrl} download="starttoo-ar-tattoo.png" className="inline-flex h-12 min-w-[150px] items-center justify-center rounded-full bg-brand px-8 text-[17px] font-semibold text-white">저장하기</a>
								<div className="flex w-full gap-3">
									<button type="button" onClick={onClearCapture} className="h-11 flex-1 rounded-full bg-[#E2E2E2] text-[14px] font-semibold text-[#555]">다시 촬영</button>
									<button type="button" onClick={goHome} className="h-11 flex-1 rounded-full border border-brand bg-white text-[14px] font-semibold text-brand">홈으로 가기</button>
								</div>
							</div>
						</div>
					</div>
				)}
				{homeConfirmModal}
			</>
		);
	}

	const title = "타투 시뮬레이션 - 이미지(3D)";
	if (imageStep === 3) {
		return (
			<>
				<div className="min-h-[calc(100vh-var(--nav-h))] bg-surface px-4 pb-20 pt-8">
					<MobileHeader title={title} onHome={handleHome} />
					<StepTitle onBack={onBack}>타투를 배치하고 완성된 결과를 확인하세요</StepTitle>
					<div className="h-[calc(100dvh-250px)] min-h-[420px] w-full">
						<Simulation3DStep designUrl={designUpload.preview} scan={bodyScan} onSaved={() => setSavedModalOpen(true)} />
					</div>
				</div>

				{savedModalOpen && (
					<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4" role="presentation" onClick={() => setSavedModalOpen(false)}>
						<div className="relative w-full max-w-[344px] rounded-[12px] bg-white px-7 pb-7 pt-10 text-center" role="dialog" aria-modal="true" aria-label="결과 이미지 저장 완료" onClick={(event) => event.stopPropagation()}>
							<button type="button" aria-label="닫기" onClick={() => setSavedModalOpen(false)} className="absolute right-4 top-4 text-[#40505D]"><CloseIcon /></button>
							<div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand/10 text-[26px] text-brand">✓</div>
							<h2 className="mt-4 text-[20px] font-bold">이미지가 저장되었습니다</h2>
							<p className="mt-2 text-[14px] leading-5 text-[#777]">완성된 타투 이미지를 기기에서 확인해보세요.</p>
							<div className="mt-7 flex gap-3">
								<button type="button" onClick={() => setSavedModalOpen(false)} className="h-11 flex-1 rounded-full bg-[#E2E2E2] text-[15px] font-semibold text-[#555]">계속 편집</button>
								<button type="button" onClick={goHome} className="h-11 flex-1 rounded-full bg-brand text-[15px] font-semibold text-white">홈으로 가기</button>
							</div>
						</div>
					</div>
				)}
				{homeConfirmModal}
			</>
		);
	}

	const upload = imageStep === 1 ? bodyPhotoUpload : designUpload;
	const isBodyStep = imageStep === 1;
	return (
		<div className="min-h-[calc(100vh-var(--nav-h))] bg-surface px-4 pb-24 pt-8">
			<MobileHeader title={title} onHome={handleHome} />
			<StepTitle onBack={onBack} className="mb-4">{isBodyStep ? "시착해 볼 신체 사진을 선택하세요" : "원하는 이미지 도안을 올려주세요"}</StepTitle>
			<input ref={upload.inputRef} type="file" accept="image/*" className="hidden" onChange={upload.handleChange} />
			<button type="button" onClick={upload.openPicker} className="mx-auto flex size-[110px] items-center justify-center overflow-hidden rounded-[10px] border border-[#D6D6D6] bg-white text-[#CFCFCF]">
				{upload.preview ? <img src={upload.preview} alt="선택한 이미지" className="size-full object-cover" /> : isBodyStep ? <span className="text-[40px] font-extralight">＋</span> : <ImageIcon />}
			</button>
			<p className="mt-4 text-center text-[14px] font-light text-[#B7B7B7]">JPG, JPEG, PNG, WEBP 형식 지원</p>

			{!isBodyStep && (
				<div className="mt-8 flex gap-2">
					<button type="button" onClick={designUpload.openPicker} className="h-12 flex-1 rounded-full border border-black bg-white text-[16px] font-semibold">갤러리</button>
					<button type="button" onClick={onOpenDesigns} className="h-12 flex-1 rounded-full bg-brand text-[16px] font-semibold text-white">내 도안보관함</button>
				</div>
			)}

			<BottomButton disabled={!upload.preview} onClick={onNext}>다음</BottomButton>
			{homeConfirmModal}
		</div>
	);
}
