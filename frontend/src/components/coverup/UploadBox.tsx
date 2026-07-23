import { useRef } from "react";
import type { ChangeEvent, DragEvent } from "react";
import ActionButton from "../common/ActionButton";

type UploadBoxProps = {
	onSelect: (file: File) => void;
};

export default function UploadBox({ onSelect }: UploadBoxProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) onSelect(file);
		e.target.value = "";
	};

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		const file = e.dataTransfer.files?.[0];
		if (file && file.type.startsWith("image/")) onSelect(file);
	};

	return (
		<div className="flex w-full flex-col items-center">
			<div
				className="flex h-[clamp(220px,38vh,280px)] w-full items-center justify-center rounded-[10px] border border-black/10 bg-white shadow-sm"
				onDragOver={(e) => e.preventDefault()}
				onDrop={handleDrop}>
				<div className="text-center">
					<p className="text-[14px] font-light leading-6 text-black/40">
						커버업하고 싶은 부위의 사진을
						<br />
						여기로 끌어다 놓거나 아래 버튼으로 선택해주세요
					</p>
					<p className="mt-3 text-[12px] font-light text-black/30">
						지원 형식 JPG · PNG · WEBP, 최대 10MB
					</p>
				</div>
			</div>

			<ActionButton
				className="mt-5"
				onClick={() => inputRef.current?.click()}>
				컴퓨터에서 선택
			</ActionButton>

			<input
				ref={inputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={handleChange}
			/>
		</div>
	);
}
