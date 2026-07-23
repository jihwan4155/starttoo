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

	const openPicker = () => inputRef.current?.click();

	const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
		setFile(event.target.files?.[0]);

	const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
		event.preventDefault();
		setFile(event.dataTransfer.files[0]);
	};

	return { inputRef, preview, openPicker, handleChange, handleDrop };
}
