import type { ChangeEvent, DragEvent, RefObject } from "react";

type UploadDropzoneBoxProps = {
	visible: boolean;
	inputRef: RefObject<HTMLInputElement | null>;
	preview: string | null;
	onPick: () => void;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onDrop: (event: DragEvent<HTMLButtonElement>) => void;
	/**
	 * 기기 파일로 채우는 것을 막는다 (도안 단계).
	 *
	 * <p>박스를 눌러도 파일 선택창 대신 onPick이 하는 일(도안 보관함 열기)만 일어나고,
	 * 드래그 앤 드롭도 받지 않는다. 버튼만 감추면 박스 클릭·드롭으로 여전히 기기
	 * 파일이 들어와 버린다.
	 */
	fileDisabled?: boolean;
	/** 비었을 때 안내 문구 (기본: 사진 업로드) */
	emptyTitle?: string;
	emptySubtitle?: string;
};

export default function UploadDropzoneBox({
	visible,
	inputRef,
	preview,
	onPick,
	onChange,
	onDrop,
	fileDisabled = false,
	emptyTitle = "드래그 또는 클릭해 사진 업로드",
	emptySubtitle = "JPG, JPEG, PNG, WEBP 형식 지원",
}: UploadDropzoneBoxProps) {
	return (
		<>
			{!fileDisabled && (
				<input
					ref={inputRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={onChange}
				/>
			)}

			<button
				type="button"
				onClick={onPick}
				onDragOver={(event) => event.preventDefault()}
				onDrop={fileDisabled ? undefined : onDrop}
				className={`mx-auto flex h-full max-h-[400px] w-full max-w-[700px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[12px] border ${
					visible ? "" : "hidden"
				} ${
					preview
						? "border-black/10 bg-[#f5f5f5]"
						: "border-dashed border-black/15 bg-white"
				}`}>
				{preview ? (
					/* 도안은 배경이 비어 있어 검은 바탕에서는 검은 선이 묻힌다.
					   도안 보관함 썸네일과 같은 흰 바탕에 얹어 목록에서 보던 그대로 보여준다. */
					<img
						src={preview}
						alt="업로드한 이미지"
						className="size-full object-contain mix-blend-multiply"
					/>
				) : (
					<>
						<p className="text-[13px] font-light text-black/40">{emptyTitle}</p>
						{emptySubtitle && (
							<p className="text-[11px] font-light text-black/30">
								{emptySubtitle}
							</p>
						)}
					</>
				)}
			</button>
		</>
	);
}
