import { useEffect, useRef, useState } from "react";
import ActionButton from "../components/common/ActionButton";
import DesignExtractResultModal from "../components/community/DesignExtractResultModal";
import UploadBox from "../components/coverup/UploadBox";
import StarttooLoader from "../components/loader/StarttooLoader";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../constants/upload";
import usePhotoDesignExtractMutation from "../hooks/mutations/usePhotoDesignExtract";

/**
 * 사진 한 장 → 도안 추출.
 *
 * 게시글 상세의 "도안 추출"과 같은 결과 모달을 쓴다. 다만 그쪽은 글을 올릴 때
 * 분류 과정에서 만들어 둔 도안을 조회하는 것이라 보관함 저장(tattooSeq)이 되고,
 * 여기서 올린 사진은 서버에 등록된 타투가 아니라 PNG 다운로드만 제공한다.
 */
export default function DesignExtractPage() {
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

	// 추출 결과 objectURL 정리 — 다음 결과가 나오거나 화면을 떠날 때
	useEffect(
		() => () => {
			if (result) URL.revokeObjectURL(result.previewUrl);
		},
		[result],
	);

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

	return (
		<div className="min-h-[calc(100dvh-44px)] bg-surface lg:min-h-[calc(100dvh-52px)]">
			<div className="mx-auto flex w-full max-w-[1020px] flex-col px-6 pb-10 pt-8">
				<h1 className="text-center text-[26px] font-extrabold text-black">
					도안 추출
				</h1>
				<span aria-hidden className="mx-auto mt-4 h-px w-6 bg-brand/60" />

				<p className="mt-5 text-center text-[15px] font-semibold text-black/80">
					추출을 원하는 사진을 올려주세요
				</p>

				<div className="mt-5 flex h-[min(52dvh,400px)] items-center justify-center">
					<UploadBox
						inputRef={fileInputRef}
						preview={previewUrl}
						onPick={() => fileInputRef.current?.click()}
						onSelect={handleSelectFile}
					/>
				</div>

				<div className="mt-6 flex flex-wrap items-center justify-center gap-2">
					<ActionButton
						variant={file ? "outline" : "primary"}
						onClick={() => fileInputRef.current?.click()}>
						컴퓨터에서 선택
					</ActionButton>
					{file && (
						<ActionButton onClick={handleExtract} disabled={isPending}>
							{isPending ? (
								<>
									<StarttooLoader variant="mark" size={18} label={null} />
									추출 중…
								</>
							) : (
								"추출"
							)}
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

			<DesignExtractResultModal result={result ?? null} onClose={reset} />
		</div>
	);
}
