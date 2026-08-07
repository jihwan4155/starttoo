import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { createPortal } from "react-dom";
import ActionButton from "../common/ActionButton";
import ArchivePickerModal from "./ArchivePickerModal";
import ImageCropper from "./ImageCropper";
import { CloseIcon } from "./icons";
import useCreatePost from "../../hooks/mutations/useCreatePost";
import useBackClose from "../../hooks/useBackClose";
import useDragSort from "../../hooks/useDragSort";
import useRequireAuth from "../../hooks/useRequireAuth";
import useAuthStore from "../../store/useAuthStore";
import { ApiError } from "../../services/api";
import { dataUrlToFile } from "../../utils/dataUrlToFile";
import {
	cropImageToDataUrl,
	DEFAULT_CROP,
	POST_IMAGE_ASPECT,
} from "../../utils/image";
import { resolveAvatar } from "../../utils/profile";
import { urlToFile } from "../../utils/urlToFile";
import type { ArchiveItem } from "../../types/archive";
import type { CropState } from "../../utils/image";
import LoadingLabel from "../loader/LoadingLabel";

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

function HomeIcon() {
	return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 10.8 12 3l9 7.8V21h-6v-6H9v6H3V10.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
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
			<div className="aspect-[3/4] w-full overflow-hidden rounded-[10px] bg-[#D9D9D9]">
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

/** 새 피드 만들기 — 이미지 선택 → 자르기 → 문구 작성 3단계 */
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
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [isArchiveOpen, setArchiveOpen] = useState(false);
	const { mutateAsync: createPostMutate, isPending: isCreatePending } =
		useCreatePost();
	const { isAuthenticated, requireAuth } = useRequireAuth();
	const authUser = useAuthStore((s) => s.user);
	const nickname = authUser?.nickname ?? "게스트";
	const avatarUrl = resolveAvatar(
		authUser && "profileImageUrl" in authUser
			? authUser.profileImageUrl
			: null,
		nickname,
	);

	// 선택한 사진 순서 바꾸기 (드래그 · 방향키 공용)
	const moveImage = (from: number, to: number) => {
		setImages((prev) => {
			if (to < 0 || to >= prev.length || from === to) return prev;
			const next = [...prev];
			const [moved] = next.splice(from, 1);
			next.splice(to, 0, moved);
			return next;
		});
	};

	const { getItemProps, dragIndex } = useDragSort({ onReorder: moveImage });

	// 뒤로가기는 페이지를 떠나는 대신 이 창만 닫는다 (올리는 중에는 닫지 않는다).
	// handleClose는 아래에서 선언되지만, 이 함수는 렌더가 끝난 뒤에만 불린다.
	useBackClose(isOpen, () => {
		if (!isSubmitting && !isCreatePending) handleClose();
	});

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
		setSubmitError(null);
	};

	const handleClose = () => {
		// 미리보기 URL 해제 (피드에는 압축된 base64가 저장되므로 항상 해제)
		images.forEach((image) => URL.revokeObjectURL(image.url));
		reset();
		onClose();
	};

	const handleHome = () => {
		handleClose();
		window.location.assign("/");
	};

	const addFiles = (files: FileList | null) => {
		if (!files) return;
		const next = [...files]
			.filter((file) => file.type.startsWith("image/"))
			.map((file) => ({ file, url: URL.createObjectURL(file) }));
		setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
	};

	const addArchiveItem = async (item: ArchiveItem) => {
		try {
			const imageUrl = item.designImageUrl || item.originalImageUrl;
			const file = await urlToFile(imageUrl, `archive-${item.tattooId}.jpg`);
			const url = URL.createObjectURL(file);
			setImages((prev) => [...prev, { file, url }].slice(0, MAX_IMAGES));
		} catch (err) {
			window.alert(
				err instanceof Error
					? err.message
					: "도안 보관함 이미지를 불러오지 못했습니다.",
			);
		}
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
					cropImageToDataUrl(image.file, crops[image.url] ?? DEFAULT_CROP, {
						aspect: POST_IMAGE_ASPECT,
					}),
				),
			);
			setCroppedUrls(urls);
			setImageIndex(0);
			setStep("write");
		} finally {
			setCropping(false);
		}
	};

	// presigned 업로드 → POST /posts
	const handleSubmit = async () => {
		if (isSubmitting || isCreatePending || !croppedUrls[0]) return;
		if (!isAuthenticated) return;
		setSubmitting(true);
		setSubmitError(null);
		try {
			const files = croppedUrls.map((url, index) =>
				dataUrlToFile(url, `post-${index + 1}`),
			);
			await createPostMutate({ files, caption: caption.trim() });
			handleClose();
		} catch (err) {
			setSubmitError(
				err instanceof ApiError
					? err.message
					: err instanceof Error
						? err.message
						: "피드 업로드에 실패했습니다.",
			);
			setSubmitting(false);
		}
	};

	return createPortal(
		<div
			className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-6 max-lg:bg-surface max-lg:p-0"
			onClick={handleClose}
			role="presentation">
			{/* 헤더가 흰 배경이라 잘라내지 않으면 둥근 모서리를 덮어 각이 진다 */}
			<div
				className="w-full max-w-[640px] overflow-hidden rounded-2xl bg-white max-lg:flex max-lg:min-h-dvh max-lg:max-w-none max-lg:flex-col max-lg:rounded-none max-lg:bg-surface"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="새 피드 만들기">
				{/* 헤더 */}
				<div className="relative flex h-[52px] shrink-0 items-center justify-center border-b border-black/10 bg-white px-4 max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:z-20">
					<button type="button" onClick={handleHome} aria-label="홈으로 가기" className="absolute left-4 hidden size-8 items-center justify-center text-[#555] max-lg:flex"><HomeIcon /></button>
					<p className="text-[15px] font-semibold text-black">
						{step === "select" && "새 피드 만들기"}
						{step === "crop" && "자르기"}
						{step === "write" && "새 피드 만들기"}
					</p>
					{step !== "select" && <button type="button" onClick={() => setStep(step === "write" ? "crop" : "select")} className="absolute left-4 flex items-center gap-0.5 text-[13px] text-black/60 max-lg:hidden"><ChevronIcon direction="left" />이전</button>}
					<div className="absolute right-4 max-lg:hidden">
						{step === "select" && images.length === 0 && <button type="button" aria-label="닫기" onClick={handleClose} className="text-black/60"><CloseIcon size={18} /></button>}
						{step === "select" && images.length > 0 && <button type="button" onClick={() => { setImageIndex(0); setStep("crop"); }} className="text-[14px] font-semibold text-brand">다음</button>}
						{step === "crop" && <button type="button" onClick={handleCropDone} disabled={isCropping} className="text-[14px] font-semibold text-brand disabled:opacity-50">{isCropping ? "적용 중..." : "다음"}</button>}
						{step === "write" && <button type="button" onClick={handleSubmit} disabled={isSubmitting || isCreatePending} className="text-[14px] font-semibold text-brand disabled:opacity-50">{isSubmitting || isCreatePending ? <LoadingLabel>올리는 중…</LoadingLabel> : "피드 올리기"}</button>}
					</div>
				</div>

				{/* 1단계: 이미지 선택 */}
				{step === "select" && (
					<div className="p-6 max-lg:flex max-lg:flex-1 max-lg:flex-col max-lg:px-4 max-lg:pb-24 max-lg:pt-[76px]">
						{images.length === 0 ? (
							<div
								role="presentation"
								onClick={() => fileInputRef.current?.click()}
								onDragOver={(e) => e.preventDefault()}
								onDrop={handleDrop}
								className="flex h-[240px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-black/15 bg-white transition hover:border-brand/40 max-lg:h-[300px]">
								<p className="text-center text-[13px] font-light leading-6 text-black/40">
									드래그 하거나 클릭해 사진을 업로드해주세요
									<br />
									JPG, JPEG, PNG, WEBP 형식 지원
								</p>
							</div>
						) : (
							<>
								{/* 최대 10장이라 5×2로 한 번에 다 보인다 */}
								<div className="grid grid-cols-5 gap-2" data-sort-container>
									{images.map((image, index) => (
										<div
											// 미리보기 URL이 고유값
											key={image.url}
											{...getItemProps(index)}
											tabIndex={0}
											role="button"
											aria-label={`선택한 사진 ${index + 1} — 끌어서 옮기거나 방향키로 순서를 바꿉니다`}
											onKeyDown={(e) => {
												if (e.key === "ArrowLeft") {
													e.preventDefault();
													moveImage(index, index - 1);
												} else if (e.key === "ArrowRight") {
													e.preventDefault();
													moveImage(index, index + 1);
												}
											}}
											className={`relative aspect-square overflow-hidden rounded-[10px] bg-[#D9D9D9] outline-none ring-brand focus-visible:ring-2 ${
												dragIndex === index
													? "shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
													: "cursor-grab transition-shadow"
											}`}>
											<img
												src={image.url}
												alt={`선택한 사진 ${index + 1}`}
												draggable={false}
												className="h-full w-full object-cover"
											/>
											<span className="pointer-events-none absolute bottom-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-black/55 text-[11px] font-medium text-white">
												{index + 1}
											</span>
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
								{/* 조작법이 달라 데스크톱·모바일 문구를 나눈다 */}
								{images.length > 1 && (
									<p className="mt-3 text-right text-[12px] font-light text-black/40">
										<span className="max-lg:hidden">
											사진을 끌어서 순서를 바꿀 수 있어요
										</span>
										<span className="lg:hidden">
											사진을 꾹 누른 후 끌어서 순서를 바꿀 수 있어요
										</span>
									</p>
								)}
							</>
						)}

						<div className="mt-5 flex justify-center gap-4 max-lg:mt-8 max-lg:flex-col max-lg:px-12">
							<ActionButton
								variant="outline"
								onClick={() => fileInputRef.current?.click()}>
								컴퓨터에서 선택
							</ActionButton>
							{/* TODO: 도안 보관함 연동되면 도안 보관함 선택 모달로 교체 */}
							<ActionButton
								onClick={() => requireAuth(() => setArchiveOpen(true))}>
								도안 보관함에서 선택
							</ActionButton>
						</div>
						<p className="mt-3 text-center text-[12px] font-light text-black/40">
							사진을 한 번에 최대 {MAX_IMAGES}장까지 업로드할 수 있어요.
						</p>
					</div>
				)}

				{/* 2단계: 자르기 — 드래그로 영역 이동, 슬라이더로 확대/축소 */}
				{step === "crop" && (
					<div className="p-8 max-lg:flex-1 max-lg:px-8 max-lg:pb-24 max-lg:pt-[84px]">
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
								aspect={POST_IMAGE_ASPECT}
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
					<div className="flex gap-5 p-6 max-lg:flex-1 max-lg:flex-col max-lg:px-5 max-lg:pb-24 max-lg:pt-[84px]">
						<div className="w-[280px] shrink-0 max-lg:hidden">
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
								<img
									src={resolveAvatar(avatarUrl)}
									alt=""
									className="size-8 shrink-0 rounded-full bg-[#D9D9D9] object-cover"
								/>
								<span className="text-[14px] font-semibold text-black">
									{nickname}
								</span>
							</div>
							<div className="relative mt-3 flex-1 max-lg:min-h-[300px]">
								<textarea
									value={caption}
									onChange={(e) =>
										setCaption(
											e.target.value.slice(0, MAX_CAPTION_LENGTH),
										)
									}
									placeholder="문구를 입력해주세요..."
									className="h-full min-h-[200px] w-full resize-none rounded-[10px] border border-black/15 bg-white p-3 text-[13px] font-light leading-5 text-black outline-none placeholder:text-black/35 focus:border-brand/50"
								/>
								<span className="absolute bottom-2.5 right-3 text-[11px] font-light text-black/35">
									{caption.length}/{MAX_CAPTION_LENGTH}
								</span>
							</div>
							{submitError && (
								<p className="mt-2 text-[12px] text-brand">{submitError}</p>
							)}
						</div>
					</div>
				)}

				{/* 모바일 단계 이동 — 헤더가 아닌 본문 하단에 배치 */}
				<div className="fixed inset-x-0 bottom-0 z-20 hidden h-[68px] items-center gap-3 border-t border-black/5 bg-white px-4 max-lg:flex">
					{step !== "select" && (
						<button type="button" onClick={() => setStep(step === "write" ? "crop" : "select")} disabled={isCropping || isSubmitting || isCreatePending} className="h-12 flex-1 rounded-full border border-black bg-white text-[16px] font-semibold disabled:opacity-40">이전</button>
					)}
					{step === "select" && (
						<button type="button" disabled={images.length === 0} onClick={() => { setImageIndex(0); setStep("crop"); }} className="h-12 flex-1 rounded-full bg-brand text-[16px] font-semibold text-white disabled:bg-[#D9D9D9] disabled:text-[#888]">다음</button>
					)}
					{step === "crop" && (
						<button type="button" onClick={handleCropDone} disabled={isCropping} className="h-12 flex-1 rounded-full bg-brand text-[16px] font-semibold text-white disabled:opacity-50">{isCropping ? "적용 중..." : "다음"}</button>
					)}
					{step === "write" && (
						<button type="button" onClick={handleSubmit} disabled={isSubmitting || isCreatePending} className="h-12 flex-1 rounded-full bg-brand text-[16px] font-semibold text-white disabled:opacity-50">{isSubmitting || isCreatePending ? <LoadingLabel>올리는 중…</LoadingLabel> : "피드 올리기"}</button>
					)}
				</div>

				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					multiple
					className="hidden"
					onChange={handleFileChange}
				/>
			</div>

			<ArchivePickerModal
				isOpen={isArchiveOpen}
				onClose={() => setArchiveOpen(false)}
				onSelect={(item) => void addArchiveItem(item)}
			/>
		</div>,
		document.body,
	);
}
