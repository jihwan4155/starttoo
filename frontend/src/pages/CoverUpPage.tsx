import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import ActionButton from "../components/common/ActionButton";
import ConfirmModal from "../components/common/ConfirmModal";
import ImageViewerModal from "../components/common/ImageViewerModal";
import RegionSelector from "../components/coverup/RegionSelector";
import StepHeader from "../components/coverup/StepHeader";
import UploadBox from "../components/coverup/UploadBox";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../constants/upload";
import useCoverupRecommendationMutation from "../hooks/mutations/useCoverupRecommendation";
import type { CoverupSelection } from "../types/coverup";

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

function ZoomIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round">
			<circle cx="11" cy="11" r="7" />
			<path d="m21 21-4.3-4.3" />
		</svg>
	);
}

export default function CoverUpPage() {
	const navigate = useNavigate();
	const reloadInputRef = useRef<HTMLInputElement>(null);

	const [step, setStep] = useState<Step>(1);
	const [file, setFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [fileError, setFileError] = useState<string | null>(null);
	const [selection, setSelection] = useState<CoverupSelection | null>(null);
	const [results, setResults] = useState<string[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isViewerOpen, setViewerOpen] = useState(false);
	const [isSavedOpen, setSavedOpen] = useState(false);

	const recommendMutation = useCoverupRecommendationMutation();

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
		setFileError(null);
		setFile(nextFile);
		setPreviewUrl(URL.createObjectURL(nextFile));
		setSelection(null);
	};

	const handleReloadChange = (e: ChangeEvent<HTMLInputElement>) => {
		const nextFile = e.target.files?.[0];
		if (nextFile) handleSelectFile(nextFile);
		e.target.value = "";
	};

	// 영역 선택값은 현재 백엔드 스펙상 전송하지 않음 (서버가 흉터 영역 자동 탐지)
	// TODO: 흉터 탐지 결과 API가 생기면 STEP 2를 수동 선택 → 탐지 결과 확인으로 교체
	const handleRecommend = () => {
		if (!file || !selection) return;
		recommendMutation.mutate(
			{ image: file },
			{
				onSuccess: (data) => {
					setResults((prev) => [...prev, data.imageUrl]);
					setSelectedIndex(results.length);
					setStep(3);
				},
			},
		);
	};

	// 기능명세 4-4: 현재 결과를 초기화하고 처음부터 다시 진행
	const handleReset = () => {
		setStep(1);
		setFile(null);
		setPreviewUrl(null);
		setFileError(null);
		setSelection(null);
		setResults([]);
		setSelectedIndex(0);
		recommendMutation.reset();
	};

	// TODO: 커버업 결과 저장 API 확정되면 연동 (현재 /archive/{tattooId}는
	// tattooId가 필요한데 커버업 응답에 없음). 저장 성공 시에만 모달 표시.
	const handleSave = () => {
		setSavedOpen(true);
	};

	const selectedResult = results[selectedIndex] ?? null;

	return (
		<div className="flex min-h-[calc(100vh-60px)] flex-col items-center bg-surface px-6 pb-10">
			{/* 기능명세 4-1: 서비스 소개 섹션 */}
			<p className="mt-6 text-[14px] font-light text-black/60">
				흉터도, 오래된 타투도 새롭게
			</p>
			<h1 className="mt-1 text-[28px] font-extrabold text-black">
				커버업 타투 도안 추천
			</h1>
			<p className="mt-2 whitespace-nowrap text-center text-[14px] font-light text-black/50">
				흉터 이미지를 업로드하면 AI가 흉터 영역을 탐지하고 어울리는 타투
				도안을 추천해드려요.
			</p>

			<div className="mt-6 flex w-full max-w-[560px] flex-col items-center">
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
							<RegionSelector src={previewUrl} selection={null} />
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

				{step === 2 && previewUrl && (
					<>
						<StepHeader
							step={2}
							description="덮을 영역을 드래그로 선택해주세요."
						/>
						<div className="mt-5 w-full">
							<RegionSelector
								src={previewUrl}
								selection={selection}
								onChange={setSelection}
								selectable
							/>
						</div>
						<div className="mt-5 flex gap-4">
							<ActionButton
								variant="outline"
								onClick={() => reloadInputRef.current?.click()}>
								<ReloadIcon />
								다시 올리기
							</ActionButton>
							<ActionButton
								onClick={handleRecommend}
								disabled={!selection || recommendMutation.isPending}>
								{recommendMutation.isPending
									? "도안 생성 중..."
									: "타투 추천받기"}
							</ActionButton>
						</div>
						{recommendMutation.isError && (
							<p className="mt-4 text-[14px] text-brand">
								{recommendMutation.error.message}
							</p>
						)}
					</>
				)}

				{step === 3 && results.length > 0 && (
					<>
						<StepHeader
							step={3}
							description="도안이 완성됐어요! 마음에 드는 도안을 저장해보세요."
						/>

						{/* 기능명세 4-4: 추천 도안 카드 목록, 선택·확대 가능 */}
						<div
							className={`mt-5 grid w-full gap-4 ${
								results.length === 1 ? "grid-cols-1" : "grid-cols-2"
							}`}>
							{results.map((url, index) => (
								<div
									// 추가만 되는 목록이라 index 키 안전 (데모 모드에선 URL이 중복됨)
									key={index}
									className={`relative overflow-hidden rounded-[10px] ${
										results.length === 1 ? "" : "aspect-square"
									}`}>
									<button
										type="button"
										aria-label={`도안 ${index + 1} 선택`}
										onClick={() => setSelectedIndex(index)}
										className={`block h-full w-full rounded-[10px] transition ${
											index === selectedIndex
												? "ring-4 ring-brand"
												: "opacity-80 hover:opacity-100"
										}`}>
										<img
											src={url}
											alt={`추천 커버업 도안 ${index + 1}`}
											className={`w-full rounded-[10px] object-cover ${
												results.length === 1
													? "h-[clamp(240px,45vh,400px)]"
													: "h-full"
											}`}
										/>
									</button>
									{index === selectedIndex && (
										<button
											type="button"
											aria-label="도안 크게 보기"
											onClick={() => setViewerOpen(true)}
											className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-black shadow transition hover:bg-white">
											<ZoomIcon />
										</button>
									)}
								</div>
							))}
						</div>

						<div className="mt-5 flex gap-4">
							<ActionButton
								variant="outline"
								onClick={handleRecommend}
								disabled={recommendMutation.isPending}>
								{recommendMutation.isPending
									? "도안 생성 중..."
									: "+ 같은 조건으로 더보기"}
							</ActionButton>
							<ActionButton onClick={handleSave}>도안 저장하기</ActionButton>
						</div>
						{recommendMutation.isError && (
							<p className="mt-4 text-[14px] text-brand">
								{recommendMutation.error.message}
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
					src={selectedResult}
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
