import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

export function useImageUpload() {
	const inputRef = useRef<HTMLInputElement>(null);
	const [preview, setPreview] = useState<string | null>(null);

	const setFile = (file: File | undefined) => {
		if (!file || !file.type.startsWith("image/")) return;
		setPreview((prev) => {
			if (prev) URL.revokeObjectURL(prev);
			return URL.createObjectURL(file);
		});
	};

	/** 보관함 등 이미 존재하는 이미지 URL을 프리뷰로 설정 */
	const setFromUrl = (url: string) => {
		setPreview((prev) => {
			// 이전 값이 업로드로 만든 blob URL이면 메모리 해제
			if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
			return url;
		});
	};

	const openPicker = () => inputRef.current?.click();

	const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
		setFile(event.target.files?.[0]);

	const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
		event.preventDefault();
		setFile(event.dataTransfer.files[0]);
	};

	return { inputRef, preview, openPicker, handleChange, handleDrop, setFromUrl };
}
