import type { ChangeEvent, DragEvent, RefObject } from "react";

type UploadDropzoneBoxProps = {
	visible: boolean;
	inputRef: RefObject<HTMLInputElement | null>;
	preview: string | null;
	onPick: () => void;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onDrop: (event: DragEvent<HTMLButtonElement>) => void;
};

export default function UploadDropzoneBox({
	visible,
	inputRef,
	preview,
	onPick,
	onChange,
	onDrop,
}: UploadDropzoneBoxProps) {
	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={onChange}
			/>

			<button
				type="button"
				onClick={onPick}
				onDragOver={(event) => event.preventDefault()}
				onDrop={onDrop}
				className={`mx-auto flex aspect-[16/9] w-full max-w-[700px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[12px] border ${
					visible ? "" : "hidden"
				} ${
					preview
						? "border-black/10 bg-black"
						: "border-dashed border-black/15 bg-white"
				}`}>
				{preview ? (
					<img
						src={preview}
						alt="업로드한 이미지"
						className="size-full object-contain"
					/>
				) : (
					<>
						<p className="text-[13px] text-black/50">
							드래그 또는 클릭해 사진 업로드
						</p>
						<p className="text-[11px] text-black/35">
							JPG, JPEG, PNG, WEBP 형식 지원
						</p>
					</>
				)}
			</button>
		</>
	);
}
