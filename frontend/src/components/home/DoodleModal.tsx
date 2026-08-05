import { useEffect } from "react";
import { createPortal } from "react-dom";
import DoodleToolbar from "./DoodleToolbar";
import useDoodleCanvas from "./useDoodleCanvas";

type DoodleModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

function CloseIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
			<path
				d="M6 6l12 12M18 6 6 18"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="round"
			/>
		</svg>
	);
}

/** 줄노트 캔버스 + 펜/지우개 도구 */
export default function DoodleModal({ isOpen, onClose }: DoodleModalProps) {
	const {
		canvasRef,
		tool,
		setTool,
		size,
		setSize,
		canUndo,
		canRedo,
		undo,
		redo,
		clear,
		refresh,
		handlers,
	} = useDoodleCanvas({ color: "#171516", active: isOpen });

	useEffect(() => {
		if (!isOpen) return undefined;
		const previousOverflow = document.body.style.overflow;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.body.style.overflow = "hidden";
		document.addEventListener("keydown", onKeyDown);

		// 캔버스가 다시 마운트된 뒤 저장된 획을 즉시 복원
		let raf1 = 0;
		let raf2 = 0;
		raf1 = requestAnimationFrame(() => {
			raf2 = requestAnimationFrame(() => refresh());
		});

		return () => {
			cancelAnimationFrame(raf1);
			cancelAnimationFrame(raf2);
			document.body.style.overflow = previousOverflow;
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [isOpen, onClose, refresh]);

	if (!isOpen) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center sm:p-6"
			onClick={onClose}
			role="presentation">
			<div
				className="w-full max-w-[600px] rounded-[14px] bg-white px-4 pb-4 pt-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)] sm:max-w-[780px] sm:px-5 lg:max-w-[880px]"
				onClick={(event) => event.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="낙서장">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-[16px] font-extrabold text-black sm:text-[17px]">
						낙서장
					</h2>
					<button
						type="button"
						aria-label="닫기"
						onClick={onClose}
						className="flex size-8 items-center justify-center rounded-full text-black/70 transition hover:bg-black/5 hover:text-black">
						<CloseIcon />
					</button>
				</div>

				<div
					className="relative aspect-[3/2] w-full overflow-hidden rounded-[4px] border-2 border-brand sm:aspect-[16/10]"
					style={{
						backgroundImage:
							"repeating-linear-gradient(to bottom, #fff 0, #fff 26px, rgba(255,70,70,0.28) 27px)",
					}}>
					<canvas
						ref={canvasRef}
						className="absolute inset-0 size-full touch-none cursor-crosshair"
						aria-label="낙서 캔버스"
						{...handlers}
					/>
				</div>

				<div className="mt-3 flex justify-center">
					<DoodleToolbar
						tool={tool}
						onToolChange={setTool}
						size={size}
						onSizeChange={setSize}
						canUndo={canUndo}
						canRedo={canRedo}
						onUndo={undo}
						onRedo={redo}
						onClear={clear}
					/>
				</div>
			</div>
		</div>,
		document.body,
	);
}
