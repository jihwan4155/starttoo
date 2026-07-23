import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { createPortal } from "react-dom";
import ActionButton from "../common/ActionButton";
import ImageCropper from "./ImageCropper";
import { CloseIcon } from "./icons";
import useCommunityStore from "../../store/useCommunityStore";
import { cropImageToDataUrl, DEFAULT_CROP } from "../../utils/image";
import type { CropState } from "../../utils/image";

type Step = "select" | "crop" | "write";

/** 선택한 이미지 (원본 파일 + 미리보기 URL) */
type SelectedImage = { file: File; url: string };

const MAX_IMAGES = 10;
const MAX_CAPTION_LENGTH = 100;

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden>
			{direction === "left" ? (
				<path d="m15 5-7 7 7 7" />
			) : (
				<path d="m9 5 7 7-7 7" />
			)}
		</svg>
	);
}

/** 이미지 캐러셀 (자르기·작성 단계 공용) */
function ImageCarousel({
	images,
	index,
	onChangeIndex,
}: {
	images: string[];
	index: number;
	onChangeIndex: (next: number) => void;
}) {
	return (
		<div className="relative flex items-center justify-center">
			<div className="aspect-square w-full overflow-hidden rounded-[10px] bg-[#D9D9D9]">
				<img
					src={images[index]}
					alt={`선택한 사진 ${index + 1}`}
					className="h-full w-full object-cover"
				/>
			</div>
			{images.length > 1 && (
				<>
					<button
						type="button"
						aria-label="이전 사진"
						disabled={index === 0}
						onClick={() => onChangeIndex(index - 1)}
						className="absolute -left-3 flex size-7 items-center justify-center rounded-full bg-black text-white shadow transition hover:bg-black/80 disabled:opacity-30">
						<ChevronIcon direction="left" />
					</button>
					<button
						type="button"
						aria-label="다음 사진"
						disabled={index === images.length - 1}
						onClick={() => onChangeIndex(index + 1)}
						className="absolute -right-3 flex size-7 items-center justify-center rounded-full bg-black text-white shadow transition hover:bg-black/80 disabled:opacity-30">
						<ChevronIcon direction="right" />
					</button>
				</>
			)}
		</div>
	);
}

type CreatePostModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

/** 새 게시물 만들기 — 이미지 선택 → 자르기 → 문구 작성 3단계 */
export default function CreatePostModal({
	isOpen,
	onClose,
}: CreatePostModalProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [step, setStep] = useState<Step>("select");
	const [images, setImages] = useState<SelectedImage[]>([]);
	const [imageIndex, setImageIndex] = useState(0);
	const [caption, setCaption] = useState("");
	const [isSubmitting, setSubmitting] = useState(false);
	// 이미지별 크롭 상태 (미리보기 URL 키) + 크롭 적용된 결과 이미지
	const [crops, setCrops] = useState<Record<string, CropState>>({});
	const [croppedUrls, setCroppedUrls] = useState<string[]>([]);
	const [isCropping, setCropping] = useState(false);
	const addPost = useCommunityStore((s) => s.addPost);

	if (!isOpen) return null;

	const reset = () => {
		setStep("select");
		setImages([]);
		setImageIndex(0);
		setCaption("");
		setSubmitting(false);
		setCrops({});
		setCroppedUrls([]);
		setCropping(false);
	};

	const handleClose = () => {
		// 미리보기 URL 해제 (게시물에는 압축된 base64가 저장되므로 항상 해제)
		images.forEach((image) => URL.revokeObjectURL(image.url));
		reset();
		onClose();
	};

	const addFiles = (files: FileList | null) => {
		if (!files) return;
		const next = [...files]
			.filter((file) => file.type.startsWith("image/"))
			.map((file) => ({ file, url: URL.createObjectURL(file) }));
		setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
	};

	const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
		addFiles(e.target.files);
		e.target.value = "";
	};

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		addFiles(e.dataTransfer.files);
	};

	const removeImage = (index: number) => {
		const { url } = images[index];
		URL.revokeObjectURL(url);
		setImages((prev) => prev.filter((_, i) => i !== index));
		setCrops((prev) => {
			const next = { ...prev };
			delete next[url];
			return next;
		});
	};

	// 자르기 → 작성 단계 이동: 모든 이미지에 크롭을 적용해 압축 base64 생성
	const handleCropDone = async () => {
		if (isCropping) return;
		setCropping(true);
		try {
			const urls = await Promise.all(
				images.map((image) =>
					cropImageToDataUrl(image.file, crops[image.url] ?? DEFAULT_CROP),
				),
			);
			setCroppedUrls(urls);
			setImageIndex(0);
			setStep("write");
		} finally {
			setCropping(false);
		}
	};

	// 크롭·압축된 base64 저장 → localStorage 영속화로 새로고침해도 유지
	// TODO: 백엔드 연동 시 presigned 업로드로 교체
	const handleSubmit = () => {
		if (isSubmitting || !croppedUrls[0]) return;
		setSubmitting(true);
		try {
			addPost(croppedUrls[0], caption.trim());
			handleClose();
		} catch {
			setSubmitting(false);
		}
	};

	return createPortal(
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
			onClick={handleClose}
			role="presentation">
			<div
				className="w-full max-w-[640px] rounded-2xl bg-white"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="새 게시물 만들기">
				{/* 헤더 */}
				<div className="relative flex h-[52px] items-center justify-center border-b border-black/10 px-4">
					{step !== "select" && (
						<button
							type="button"
							onClick={() =>
								setStep(step === "write" ? "crop" : "select")
							}
							className="absolute left-4 flex items-center gap-0.5 text-[13px] font-light text-black/60 transition hover:text-black">
							<ChevronIcon direction="left" />
							이전
						</button>
					)}
					<p className="text-[15px] font-semibold text-black">
						{step === "select" && "새 게시물 만들기"}
						{step === "crop" && "자르기"}
						{step === "write" && "새 게시물 만들기"}
					</p>
					{step === "select" &&
						(images.length > 0 ? (
							<button
								type="button"
								onClick={() => {
									setImageIndex(0);
									setStep("crop");
								}}
								className="absolute right-4 flex items-center gap-0.5 text-[14px] font-semibold text-brand transition hover:brightness-90">
								다음
								<ChevronIcon direction="right" />
							</button>
						) : (
							<button
								type="button"
								aria-label="닫기"
								onClick={handleClose}
								className="absolute right-4 text-black/60 transition hover:text-black">
								<CloseIcon size={18} />
							</button>
						))}
					{step === "crop" && (
						<button
							type="button"
							onClick={handleCropDone}
							disabled={isCropping}
							className="absolute right-4 flex items-center gap-0.5 text-[14px] font-semibold text-brand transition hover:brightness-90 disabled:opacity-50">
							{isCropping ? "적용 중..." : "다음"}
							{!isCropping && <ChevronIcon direction="right" />}
						</button>
					)}
					{step === "write" && (
						<button
							type="button"
							onClick={handleSubmit}
							disabled={isSubmitting}
							className="absolute right-4 text-[14px] font-semibold text-brand transition hover:brightness-90 disabled:opacity-50">
							{isSubmitting ? "올리는 중..." : "게시물 올리기"}
						</button>
					)}
				</div>

				{/* 1단계: 이미지 선택 */}
				{step === "select" && (
					<div className="p-6">
						{images.length === 0 ? (
							<div
								role="presentation"
								onClick={() => fileInputRef.current?.click()}
								onDragOver={(e) => e.preventDefault()}
								onDrop={handleDrop}
								className="flex h-[240px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-black/15 transition hover:border-brand/40">
								<p className="text-center text-[13px] font-light leading-6 text-black/40">
									드래그 하거나 클릭해 사진을 업로드해주세요
									<br />
									JPG, JPEG, PNG, WEBP 형식 지원
								</p>
							</div>
						) : (
							<>
								<div className="grid grid-cols-3 gap-3">
									{images.map((image, index) => (
										<div
											// 미리보기 URL이 고유값
											key={image.url}
											className="relative aspect-square overflow-hidden rounded-[10px] bg-[#D9D9D9]">
											<img
												src={image.url}
												alt={`선택한 사진 ${index + 1}`}
												className="h-full w-full object-cover"
											/>
											<button
												type="button"
												aria-label={`사진 ${index + 1} 삭제`}
												onClick={() => removeImage(index)}
												className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70">
												<CloseIcon size={12} />
											</button>
										</div>
									))}
									{images.length < MAX_IMAGES && (
										<div
											role="presentation"
											onClick={() => fileInputRef.current?.click()}
											onDragOver={(e) => e.preventDefault()}
											onDrop={handleDrop}
											className="flex aspect-square cursor-pointer items-center justify-center rounded-[10px] border-2 border-dashed border-black/15 text-[24px] font-light text-black/30 transition hover:border-brand/40">
											+
										</div>
									)}
								</div>
								<p className="mt-3 text-right text-[12px] font-light text-black/40">
									사진을 한 번에 최대 {MAX_IMAGES}장까지 업로드할 수 있어요.
								</p>
							</>
						)}

						<div className="mt-5 flex justify-center gap-4">
							<ActionButton
								variant="outline"
								onClick={() => fileInputRef.current?.click()}>
								컴퓨터에서 선택
							</ActionButton>
							{/* TODO: 보관함 연동되면 보관함 선택 모달로 교체 */}
							<ActionButton>보관함에서 선택</ActionButton>
						</div>
					</div>
				)}

				{/* 2단계: 자르기 — 드래그로 영역 이동, 슬라이더로 확대/축소 */}
				{step === "crop" && (
					<div className="p-8">
						<div className="mx-auto max-w-[380px]">
							{images.length > 1 && (
								<div className="mb-3 flex items-center justify-center gap-4">
									<button
										type="button"
										aria-label="이전 사진"
										disabled={imageIndex === 0}
										onClick={() => setImageIndex(imageIndex - 1)}
										className="flex size-7 items-center justify-center rounded-full bg-black text-white shadow transition hover:bg-black/80 disabled:opacity-30">
										<ChevronIcon direction="left" />
									</button>
									<span className="text-[13px] font-light text-black/60">
										{imageIndex + 1} / {images.length}
									</span>
									<button
										type="button"
										aria-label="다음 사진"
										disabled={imageIndex === images.length - 1}
										onClick={() => setImageIndex(imageIndex + 1)}
										className="flex size-7 items-center justify-center rounded-full bg-black text-white shadow transition hover:bg-black/80 disabled:opacity-30">
										<ChevronIcon direction="right" />
									</button>
								</div>
							)}
							<ImageCropper
								// 사진을 넘기면 해당 사진의 크롭 상태로 리마운트
								key={images[imageIndex].url}
								src={images[imageIndex].url}
								crop={crops[images[imageIndex].url] ?? DEFAULT_CROP}
								onChange={(next) =>
									setCrops((prev) => ({
										...prev,
										[images[imageIndex].url]: next,
									}))
								}
							/>
						</div>
					</div>
				)}

				{/* 3단계: 문구 작성 */}
				{step === "write" && (
					<div className="flex gap-5 p-6">
						<div className="w-[280px] shrink-0">
							{/* 크롭이 적용된 결과 이미지 미리보기 */}
							<ImageCarousel
								images={
									croppedUrls.length > 0
										? croppedUrls
										: images.map((image) => image.url)
								}
								index={imageIndex}
								onChangeIndex={setImageIndex}
							/>
						</div>
						<div className="flex min-w-0 flex-1 flex-col">
							<div className="flex items-center gap-2.5">
								<span className="size-8 shrink-0 rounded-full bg-[#D9D9D9]" />
								<span className="text-[14px] font-semibold text-black">
									스누피
								</span>
							</div>
							<div className="relative mt-3 flex-1">
								<textarea
									value={caption}
									onChange={(e) =>
										setCaption(
											e.target.value.slice(0, MAX_CAPTION_LENGTH),
										)
									}
									placeholder="문구를 입력해주세요..."
									className="h-full min-h-[200px] w-full resize-none rounded-[10px] border border-black/15 p-3 text-[13px] font-light leading-5 text-black outline-none placeholder:text-black/35 focus:border-brand/50"
								/>
								<span className="absolute bottom-2.5 right-3 text-[11px] font-light text-black/35">
									{caption.length}/{MAX_CAPTION_LENGTH}
								</span>
							</div>
						</div>
					</div>
				)}

				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					multiple
					className="hidden"
					onChange={handleFileChange}
				/>
			</div>
		</div>,
		document.body,
	);
}
