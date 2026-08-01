import { useEffect, useState } from "react";
import ActionButton from "../common/ActionButton";
import ImageViewerModal from "../common/ImageViewerModal";
import DoodleToolbar from "./DoodleToolbar";
import useDoodleCanvas from "./useDoodleCanvas";

export default function DoodleHeroSection() {
	const {
		canvasRef,
		tool,
		setTool,
		size,
		setSize,
		isEmpty,
		canUndo,
		canRedo,
		undo,
		redo,
		clear,
		toFile,
		handlers,
	} = useDoodleCanvas();

	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	useEffect(
		() => () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		},
		[previewUrl]
	);

	// TODO: 그림 기반 타투 추천 API가 확정되면 내보낸 File을 그대로 전달해 연동.
	// (기존 POST /coverups/recommendations 는 흉터 사진 전용이라 재사용하지 않음)
	// 지금은 추천 입력으로 넘길 이미지를 눈으로 확인할 수 있게 미리보기만 띄운다.
	const handleRecommend = async () => {
		const file = await toFile();
		if (!file) return;
		setPreviewUrl(URL.createObjectURL(file));
	};

	return (
		<section className="relative h-[calc(100vh-60px)] min-h-[600px] w-full overflow-hidden bg-surface">
			{/* 모눈 배경 — 캔버스에는 사용자가 그린 선만 남도록 CSS로 그린다.
			    작은 칸 20px, 5칸마다 굵은 칸 100px로 모눈종이 느낌을 낸다 */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{
					backgroundImage: [
						"linear-gradient(to right, rgba(255,70,70,0.16) 1px, transparent 1px)",
						"linear-gradient(to bottom, rgba(255,70,70,0.16) 1px, transparent 1px)",
						"linear-gradient(to right, rgba(255,70,70,0.07) 1px, transparent 1px)",
						"linear-gradient(to bottom, rgba(255,70,70,0.07) 1px, transparent 1px)",
					].join(", "),
					backgroundSize: "100px 100px, 100px 100px, 20px 20px, 20px 20px",
				}}
			/>

			<canvas
				ref={canvasRef}
				className={`absolute left-0 top-0 touch-none ${
					tool === "eraser" ? "cursor-cell" : "cursor-crosshair"
				}`}
				{...handlers}
			/>

			{/* 안내 문구 — 그리기를 막지 않도록 클릭을 통과시킨다 */}
			<div className="pointer-events-none absolute inset-x-0 top-14 flex flex-col items-center px-6 text-center">
				<p className="text-[24px] font-normal leading-7 text-black">
					그림 한 장으로 취향을 읽어드려요
				</p>
				<h1 className="mt-4 text-[48px] font-extrabold leading-[57px] text-black">
					떠오르는 대로 그려보세요
				</h1>
				<p className="mt-4 text-[18px] font-light leading-[21px] text-black/60">
					다 그렸다면 아래 버튼을 눌러 어울리는 타투 도안을 추천받아 보세요.
				</p>
			</div>

			{isEmpty && (
				<p className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[20px] font-light text-black/25">
					이 종이를 자유롭게 채워주세요
				</p>
			)}

			<div className="pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center gap-4 px-6">
				<div className="pointer-events-auto">
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
				<ActionButton
					onClick={handleRecommend}
					disabled={isEmpty}
					className="pointer-events-auto shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
					이 그림으로 타투 추천받기
				</ActionButton>
			</div>

			{previewUrl && (
				<ImageViewerModal
					src={previewUrl}
					alt="추천 요청에 사용할 내 그림"
					isOpen
					onClose={() => setPreviewUrl(null)}
				/>
			)}
		</section>
	);
}
