import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ActionButton from "../common/ActionButton";
import DesignExtractResultModal from "../community/DesignExtractResultModal";
import { CloseIcon } from "../community/icons";
import UploadBox from "../coverup/UploadBox";
import useBackClose from "../../hooks/useBackClose";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../../constants/upload";
import usePhotoDesignExtractMutation from "../../hooks/mutations/usePhotoDesignExtract";
import LoadingLabel from "../loader/LoadingLabel";

type DesignExtractModalProps = {
	onClose: () => void;
};

/**
 * 사진 한 장 → 도안 추출.
 *
 * <p>피드 상세의 "도안 추출"과 같은 결과 모달을 쓴다. 다만 그쪽은 글을 올릴 때
 * 분류 과정에서 만들어 둔 도안을 조회하는 것이라 보관함 저장(tattooSeq)이 되고,
 * 여기서 올린 사진은 서버에 등록된 타투가 아니라 PNG 다운로드만 제공한다.
 *
 * <p>열려 있는 동안에만 마운트되는 것을 전제한다 — 닫으면 그대로 언마운트되어
 * 고른 사진과 추출 결과가 정리되고, 다시 열면 빈 화면에서 시작한다.
 */
export default function DesignExtractModal({
	onClose,
}: DesignExtractModalProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [fileError, setFileError] = useState<string | null>(null);

	const {
		mutate: extractDesign,
		data: result,
		isPending,
		error,
		reset,
	} = usePhotoDesignExtractMutation();

	// 올린 사진 미리보기 objectURL 정리
	useEffect(
		() => () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		},
		[previewUrl],
	);

	// 추출 결과 objectURL 정리 — 다음 결과가 나오거나 창을 닫을 때
	useEffect(
		() => () => {
			if (result) URL.revokeObjectURL(result.previewUrl);
		},
		[result],
	);

	// 열려 있는 동안 Esc로 닫고 배경 스크롤을 막는다
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [onClose]);

	// 뒤로가기는 페이지를 떠나는 대신 이 창만 닫는다
	useBackClose(true, onClose);

	const handleSelectFile = (nextFile: File) => {
		if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(nextFile.type)) {
			setFileError("JPG, PNG, WEBP 형식만 업로드할 수 있어요.");
			return;
		}
		if (nextFile.size > MAX_IMAGE_SIZE) {
			setFileError("이미지는 최대 10MB까지 업로드할 수 있어요.");
			return;
		}
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		setFileError(null);
		setFile(nextFile);
		setPreviewUrl(URL.createObjectURL(nextFile));
		reset();
	};

	const handleExtract = () => {
		if (!file || isPending) return;
		extractDesign(file);
	};

	const message = fileError ?? (error ? error.message : null);

	return createPortal(
		<div
			className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px] sm:p-6"
			onClick={onClose}
			role="presentation">
			<div
				className="flex max-h-[90dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="도안 추출">
				<div className="relative flex shrink-0 items-center justify-center border-b border-black/10 py-4">
					<p className="text-[15px] font-bold text-black">도안 추출</p>
					<button
						type="button"
						aria-label="닫기"
						onClick={onClose}
						className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-black/40 transition hover:bg-black/5 hover:text-black">
						<CloseIcon size={18} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-5">
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

					<div className="mt-5 flex flex-wrap items-center justify-center gap-2">
						<ActionButton
							variant={file ? "outline" : "primary"}
							onClick={() => fileInputRef.current?.click()}>
							컴퓨터에서 선택
						</ActionButton>
						{file && (
							<ActionButton onClick={handleExtract} disabled={isPending}>
								{isPending ? <LoadingLabel>추출 중…</LoadingLabel> : "추출"}
							</ActionButton>
						)}
					</div>

					<p
						className={`mt-3 text-center text-[13px] font-light ${message ? "text-brand" : "text-black/50"}`}
						role={message ? "alert" : undefined}>
						{message ??
							"타투가 찍힌 사진을 올리면 배경을 지운 도안 PNG를 만들어 드려요"}
					</p>
				</div>
			</div>

			<DesignExtractResultModal result={result ?? null} onClose={reset} />
		</div>,
		document.body,
	);
}
