import type { ReactNode } from "react";
import { ROTATION_STEP } from "./useDoodleCanvas";
import type { DoodleTool } from "./useDoodleCanvas";

const STROKE_SIZES = [
	{ value: 2, label: "얇은 선" },
	{ value: 4, label: "보통 선" },
	{ value: 8, label: "굵은 선" },
] as const;

function PenIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round">
			<path d="M12 19l7-7 3 3-7 7-3-3z" />
			<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
			<path d="M2 2l7.586 7.586" />
			<circle cx="11" cy="11" r="2" />
		</svg>
	);
}

function EraserIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round">
			<path d="M20 20H8.5L3 14.5a1.5 1.5 0 0 1 0-2.12l7.9-7.9a1.5 1.5 0 0 1 2.12 0l6.5 6.5a1.5 1.5 0 0 1 0 2.12L12 20" />
			<path d="M6 17.5 13.5 10" />
		</svg>
	);
}

function UndoIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round">
			<path d="M3 7v6h6" />
			<path d="M3.5 13a9 9 0 1 0 2.6-6.4L3 9.5" />
		</svg>
	);
}

function RedoIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round">
			<path d="M21 7v6h-6" />
			<path d="M20.5 13a9 9 0 1 1-2.6-6.4L21 9.5" />
		</svg>
	);
}

/** 되돌리기 화살표와 헷갈리지 않도록 사각 도안이 도는 모양으로 그린다 */
function RotateIcon({ clockwise = true }: { clockwise?: boolean }) {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			style={clockwise ? undefined : { transform: "scaleX(-1)" }}>
			<rect x="4" y="11" width="12" height="9" rx="1.5" />
			<path d="M13 7h4a4 4 0 0 1 4 4" />
			<path d="m11 4.5 2.4 2.5L11 9.5" />
		</svg>
	);
}

type ToolbarButtonProps = {
	label: string;
	active?: boolean;
	disabled?: boolean;
	onClick: () => void;
	children: ReactNode;
};

function ToolbarButton({
	label,
	active = false,
	disabled = false,
	onClick,
	children,
}: ToolbarButtonProps) {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			aria-pressed={active}
			disabled={disabled}
			onClick={onClick}
			className={`flex h-8 w-8 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-30 lg:h-9 lg:w-9 ${
				active
					? "bg-brand text-white"
					: "text-black/70 hover:bg-black/5 hover:text-black"
			}`}>
			{children}
		</button>
	);
}

function Divider() {
	return <span className="h-5 w-px bg-black/10 lg:h-6" />;
}

type DoodleToolbarProps = {
	tool: DoodleTool;
	onToolChange: (tool: DoodleTool) => void;
	size: number;
	onSizeChange: (size: number) => void;
	canUndo: boolean;
	canRedo: boolean;
	onUndo: () => void;
	onRedo: () => void;
	/** 현재 회전 각도(도) — 0이면 배지를 숨긴다 */
	rotation: number;
	onRotate: (deltaDeg: number) => void;
	onResetRotation: () => void;
	onClear: () => void;
};

export default function DoodleToolbar({
	tool,
	onToolChange,
	size,
	onSizeChange,
	canUndo,
	canRedo,
	onUndo,
	onRedo,
	rotation,
	onRotate,
	onResetRotation,
	onClear,
}: DoodleToolbarProps) {
	return (
		<div className="flex max-w-[calc(100vw-24px)] items-center gap-1 overflow-x-auto rounded-full border border-black/10 bg-white/90 px-2 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.08)] backdrop-blur lg:max-w-none lg:overflow-visible lg:px-3 lg:py-2">
			<ToolbarButton
				label="펜"
				active={tool === "pen"}
				onClick={() => onToolChange("pen")}>
				<PenIcon />
			</ToolbarButton>
			<ToolbarButton
				label="지우개"
				active={tool === "eraser"}
				onClick={() => onToolChange("eraser")}>
				<EraserIcon />
			</ToolbarButton>

			<Divider />

			{/* 선 두께 — 실제 두께를 점 크기로 보여준다 */}
			{STROKE_SIZES.map((option) => (
				<ToolbarButton
					key={option.value}
					label={option.label}
					active={size === option.value}
					onClick={() => onSizeChange(option.value)}>
					<span
						className="rounded-full bg-current"
						style={{
							width: `${option.value + 3}px`,
							height: `${option.value + 3}px`,
						}}
					/>
				</ToolbarButton>
			))}

			<Divider />

			<ToolbarButton label="되돌리기" disabled={!canUndo} onClick={onUndo}>
				<UndoIcon />
			</ToolbarButton>
			<ToolbarButton label="다시 실행" disabled={!canRedo} onClick={onRedo}>
				<RedoIcon />
			</ToolbarButton>

			<Divider />

			{/* 회전 — 그린 그림 전체를 캔버스 중심으로 돌린다 */}
			<ToolbarButton
				label={`왼쪽으로 ${ROTATION_STEP}도 회전`}
				disabled={!canUndo}
				onClick={() => onRotate(-ROTATION_STEP)}>
				<RotateIcon clockwise={false} />
			</ToolbarButton>
			<ToolbarButton
				label={`오른쪽으로 ${ROTATION_STEP}도 회전`}
				disabled={!canUndo}
				onClick={() => onRotate(ROTATION_STEP)}>
				<RotateIcon />
			</ToolbarButton>
			{rotation !== 0 && (
				<button
					type="button"
					title="회전 초기화"
					aria-label={`회전 ${rotation}도, 눌러서 초기화`}
					onClick={onResetRotation}
					className="shrink-0 rounded-full bg-black/5 px-2 py-1 text-[11px] font-semibold tabular-nums text-black/60 transition hover:bg-black/10 hover:text-black lg:text-[12px]">
					{rotation > 0 ? `+${rotation}°` : `${rotation}°`}
				</button>
			)}

			<Divider />

			<button
				type="button"
				disabled={!canUndo}
				onClick={onClear}
				className="rounded-full px-2 text-[12px] font-normal text-black/60 transition hover:text-brand disabled:cursor-not-allowed disabled:opacity-30 lg:px-3 lg:text-[13px]">
				전체 지우기
			</button>
		</div>
	);
}
