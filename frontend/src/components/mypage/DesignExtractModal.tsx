import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ActionButton from "../common/ActionButton";
import DesignExtractResultModal from "../community/DesignExtractResultModal";
import { CloseIcon } from "../community/icons";
import UploadBox from "../coverup/UploadBox";
import StarttooLoader from "../loader/StarttooLoader";
import useBackClose from "../../hooks/useBackClose";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../../constants/upload";
import usePhotoDesignExtractMutation from "../../hooks/mutations/usePhotoDesignExtract";
import { TattooNotDetectedError } from "../../services/photoExtractApi";

type DesignExtractModalProps = {
	onClose: () => void;
};

/** 사진 업로드 즉시 타투 판정과 도안 추출을 시작하는 마이페이지 모달. */
export default function DesignExtractModal({
	onClose,
}: DesignExtractModalProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [fileError, setFileError] = useState<string | null>(null);
	const {
		mutate: extractDesign,
		data: result,
		isPending,
		error,
		reset,
	} = usePhotoDesignExtractMutation();

	useEffect(
		() => () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		},
		[previewUrl],
	);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !isPending) onClose();
		};
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isPending, onClose]);

	useBackClose(true, isPending ? () => undefined : onClose);

	const clearSelection = () => {
		setPreviewUrl(null);
		setFileError(null);
		reset();
	};

	const handleSelectFile = (file: File) => {
		if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
			setFileError("JPG, PNG, WEBP 형식만 업로드할 수 있어요.");
			return;
		}
		if (file.size > MAX_IMAGE_SIZE) {
			setFileError("이미지는 최대 10MB까지 업로드할 수 있어요.");
			return;
		}

		setPreviewUrl(URL.createObjectURL(file));
		setFileError(null);
		reset();
		extractDesign(file);
	};

	const isNotDetected = error instanceof TattooNotDetectedError;
	const failureMessage = isNotDetected
		? "타투를 검출할 수 없는 이미지입니다."
		: error?.message ?? "도안 추출에 실패했습니다. 잠시 후 다시 시도해주세요.";

	return createPortal(
		<div
			className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px] sm:p-6"
			onClick={isPending ? undefined : onClose}
			role="presentation">
			<div
				className="flex max-h-[90dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
				onClick={(event) => event.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="도안 추출">
				<div className="relative flex shrink-0 items-center justify-center border-b border-black/10 py-4">
					<p className="text-[15px] font-bold text-black">도안 추출</p>
					<button
						type="button"
						aria-label="닫기"
						onClick={onClose}
						disabled={isPending}
						className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-black/40 transition hover:bg-black/5 hover:text-black disabled:cursor-wait disabled:opacity-30">
						<CloseIcon size={18} />
					</button>
				</div>

				<div className="flex min-h-[480px] flex-1 flex-col overflow-y-auto px-6 py-5">
					{isPending ? (
						<div className="flex flex-1 flex-col items-center justify-center gap-3 py-10">
							<StarttooLoader
								variant="block"
								size={170}
								delayMs={0}
								label="타투를 확인하고 도안을 추출하는 중…"
							/>
							<p className="text-center text-[13px] text-black/45">
								사진에 따라 잠시 시간이 걸릴 수 있어요
							</p>
						</div>
					) : error ? (
						<div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
							<div className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-[28px] text-brand">
								!
							</div>
							<p className="mt-5 text-[17px] font-semibold text-black" role="alert">
								{failureMessage}
							</p>
							<p className="mt-2 text-[13px] leading-5 text-black/45">
								{isNotDetected
									? "타투가 선명하고 충분히 크게 보이는 사진으로 다시 시도해주세요."
									: "다른 사진을 선택하거나 잠시 후 다시 시도해주세요."}
							</p>
							<ActionButton className="mt-7" onClick={clearSelection}>
								다시 업로드
							</ActionButton>
						</div>
					) : (
						<>
							<p className="text-center text-[15px] font-semibold text-black/80">
								추출을 원하는 사진을 올려주세요
							</p>

							<div className="mt-4 flex h-[min(46dvh,340px)] items-center justify-center">
								<UploadBox
									inputRef={fileInputRef}
									preview={previewUrl}
									onPick={() => fileInputRef.current?.click()}
									onSelect={handleSelectFile}
								/>
							</div>

							<div className="mt-5 flex items-center justify-center">
								<ActionButton onClick={() => fileInputRef.current?.click()}>
									컴퓨터에서 선택
								</ActionButton>
							</div>

							<p
								className={`mt-3 text-center text-[13px] font-light ${fileError ? "text-brand" : "text-black/50"}`}
								role={fileError ? "alert" : undefined}>
								{fileError ??
									"타투가 찍힌 사진을 올리면 배경을 지운 도안 PNG를 만들어 드려요"}
							</p>
						</>
					)}
				</div>
			</div>

			<DesignExtractResultModal
				result={result ?? null}
				onClose={clearSelection}
				saveButtonLabel="저장하기"
			/>
		</div>,
		document.body,
	);
}
