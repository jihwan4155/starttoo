import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import LoadingLabel from "../loader/LoadingLabel";
import { describeSearchError } from "../coverup/shapeSearchError";
import useShapeSearchMutation from "../../hooks/mutations/useShapeSearch";
import type { DesignResult } from "../../types/shapeSearch";
import DoodleResultModal from "./DoodleResultModal";
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
	const searchMutation = useShapeSearchMutation();
	const [showEmptyHint, setShowEmptyHint] = useState(false);
	/** 검색 결과 — 있으면 결과 모달이 낙서장 위에 뜬다 */
	const [results, setResults] = useState<DesignResult[] | null>(null);
	const {
		canvasRef,
		tool,
		setTool,
		size,
		setSize,
		rotation,
		rotateBy,
		resetRotation,
		isEmpty,
		canUndo,
		canRedo,
		undo,
		redo,
		clear,
		buildSearchMask,
		handlers,
	} = useDoodleCanvas({ color: "#171516" });

	/*
	 * 결과는 이 자리에서 모달로 보여 준다.
	 *
	 * 예전에는 커버업 페이지로 넘겼는데, 커버업은 로그인 전용이고 신체 사진부터
	 * 다시 받는 화면이라 낙서 한 장으로 도안만 보려는 사람에게는 과한 우회였다.
	 */
	const handleSearch = () => {
		const maskPngB64 = buildSearchMask();
		if (!maskPngB64) {
			setShowEmptyHint(true);
			return;
		}
		setShowEmptyHint(false);
		searchMutation.mutate(
			{ maskPngB64, mode: "shape" },
			{
				onSuccess: (results) => {
					if (results.length === 0) return;
					setResults(results);
				},
			},
		);
	};

	const errorInfo = searchMutation.isError
		? describeSearchError(searchMutation.error)
		: null;
	const searchMessage = showEmptyHint
		? "도안을 찾을 선을 그려주세요."
		: searchMutation.isSuccess && searchMutation.data.length === 0
			? "비슷한 도안을 찾지 못했습니다. 모양을 조금 바꿔 다시 시도해주세요."
			: errorInfo?.message;

	useEffect(() => {
		if (!isOpen) return undefined;
		const previousOverflow = document.body.style.overflow;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.body.style.overflow = "hidden";
		document.addEventListener("keydown", onKeyDown);

		// 저장된 획 복원은 캔버스 ref 콜백이 마운트 시점에 처리한다(useDoodleCanvas)

		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	if (results) {
		return (
			<DoodleResultModal
				results={results}
				onRedraw={() => {
					setResults(null);
					searchMutation.reset();
				}}
				onClose={() => {
					setResults(null);
					searchMutation.reset();
					onClose();
				}}
			/>
		);
	}

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
				<div className="mb-1.5 flex items-center justify-between">
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

				{/*
				  무엇을 그려야 하는 자리인지, 그리면 무슨 일이 일어나는지 아무 설명이
				  없어서 빈 노트만 보고 닫는 경우가 있었다. 도구 이름까지 한 줄로 적어
				  아래 도구 막대가 무엇인지도 함께 읽히게 한다.
				*/}
				<p className="mb-3 text-[12.5px] font-light leading-[1.55] text-black/55">
					찾고 싶은 타투 모양을 그려 보세요. 그린 선을 닮은 도안을 찾아 드려요.
					<br className="hidden sm:block" />
					<span className="sm:hidden"> </span>
					펜·지우개로 다듬고, 되돌리기·선 굵기·회전으로 모양을 맞출 수 있어요.
				</p>

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
						onPointerDown={(event) => {
							setShowEmptyHint(false);
							searchMutation.reset();
							handlers.onPointerDown(event);
						}}
					/>
				</div>

				{searchMessage && (
					<p className="mt-2 text-center text-[13px] text-brand" role="alert">
						{searchMessage}
					</p>
				)}

				<div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
					<span aria-hidden />
					<DoodleToolbar
						tool={tool}
						onToolChange={setTool}
						size={size}
						onSizeChange={setSize}
						canUndo={canUndo}
						canRedo={canRedo}
						onUndo={undo}
						onRedo={redo}
						rotation={rotation}
						onRotate={rotateBy}
						onResetRotation={resetRotation}
						onClear={() => {
							clear();
							setShowEmptyHint(false);
							searchMutation.reset();
						}}
					/>
					<button
						type="button"
						onClick={handleSearch}
						disabled={isEmpty || searchMutation.isPending}
						className="h-10 justify-self-end rounded-full bg-brand px-5 text-[14px] font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-black/30">
						{searchMutation.isPending ? (
							<LoadingLabel>찾는 중…</LoadingLabel>
						) : (
							"도안 찾기"
						)}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
