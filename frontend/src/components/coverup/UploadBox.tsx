import type { ChangeEvent, DragEvent, RefObject } from "react";

type UploadBoxProps = {
	inputRef: RefObject<HTMLInputElement | null>;
	/** 업로드한 사진 미리보기 URL. 없으면 안내 문구를 보여준다 */
	preview: string | null;
	onPick: () => void;
	onSelect: (file: File) => void;
};

/**
 * 신체 사진 드롭존.
 *
 * <p>높이를 고정하지 않고 부모가 준 만큼만 채운다. 페이지 전체가 화면 높이에
 * 맞춰져 있어서 여기서 고정 높이를 주면 세로가 짧은 화면에서 아래 버튼이 잘리거나
 * 스크롤이 생긴다.
 */
export default function UploadBox({
	inputRef,
	preview,
	onPick,
	onSelect,
}: UploadBoxProps) {
	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) onSelect(file);
		// 같은 파일을 다시 골라도 change가 나도록 값을 비운다
		event.target.value = "";
	};

	const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
		event.preventDefault();
		const file = event.dataTransfer.files?.[0];
		if (file) onSelect(file);
	};

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={handleChange}
			/>

			<button
				type="button"
				onClick={onPick}
				onDragOver={(event) => event.preventDefault()}
				onDrop={handleDrop}
				className={`mx-auto flex h-full max-h-[400px] w-full max-w-[700px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[12px] border ${
					preview
						? "border-black/10 bg-black"
						: "border-dashed border-black/15 bg-white"
				}`}>
				{preview ? (
					<img
						src={preview}
						alt="업로드한 부위 사진"
						className="size-full object-contain"
					/>
				) : (
					<>
						<p className="text-[13px] font-light text-black/40">
							드래그 또는 클릭해 사진 업로드
						</p>
						<p className="text-[11px] font-light text-black/30">
							JPG, JPEG, PNG, WEBP 형식 지원
						</p>
					</>
				)}
			</button>
		</>
	);
}
