import { useMemo } from "react";
import { encodeText } from "../../utils/qrcode";
import type { ArSessionStatus } from "../../types/simulation";

/** 스캔 가능한 실제 QR 코드를 SVG로 렌더링 (quiet zone 4모듈 포함) */
function QrCode({ text, size = 230 }: { text: string; size?: number }) {
	const modules = useMemo(() => encodeText(text, "M"), [text]);
	const border = 4;
	const dim = modules.length + border * 2;

	// 검정 모듈만 path로 묶어 렌더 (rect 다발보다 가볍고 선명)
	const path = useMemo(() => {
		const parts: string[] = [];
		modules.forEach((row, y) => {
			row.forEach((dark, x) => {
				if (dark) parts.push(`M${x + border},${y + border}h1v1h-1z`);
			});
		});
		return parts.join("");
	}, [modules]);

	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${dim} ${dim}`}
			shapeRendering="crispEdges"
			role="img"
			aria-label="AR 시뮬레이션 접속 QR 코드">
			<rect width={dim} height={dim} fill="#ffffff" />
			<path d={path} fill="#111111" />
		</svg>
	);
}

function PhoneIcon() {
	return (
		<svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
			<rect
				x="6"
				y="2.5"
				width="12"
				height="19"
				rx="2.6"
				stroke="currentColor"
				strokeWidth="1.7"
			/>
			<path
				d="M10.4 5.6h3.2"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinecap="round"
			/>
			<circle cx="12" cy="13.4" r="2.7" stroke="currentColor" strokeWidth="1.7" />
		</svg>
	);
}

type CameraConnectStepProps = {
	/** 폰이 진입할 주소. 세션 발급 전에는 null */
	joinUrl: string | null;
	status: ArSessionStatus | "CREATING";
	phoneConnected: boolean;
	error: string | null;
	/** 만료·오류 시 세션 재발급 */
	onRestart: () => void;
};

/** 상태 표시줄 — 점 색 + 문구 */
function StatusPill({
	tone,
	children,
}: {
	tone: "waiting" | "connected" | "stopped";
	children: React.ReactNode;
}) {
	const dot =
		tone === "connected"
			? "bg-emerald-500"
			: tone === "stopped"
				? "bg-black/25"
				: "bg-amber-400 animate-pulse";
	return (
		<span className="flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-1.5 text-[13px] font-medium text-black/50">
			<span className={`size-[7px] rounded-full ${dot}`} />
			{children}
		</span>
	);
}

/**
 * PC AR 2단계 — 폰이 스캔할 QR을 띄우고 세션 상태를 보여준다.
 * 세션 발급·이벤트 수신은 useArSession(SimulationsPage)이 맡는다.
 */
export default function CameraConnectStep({
	joinUrl,
	status,
	phoneConnected,
	error,
	onRestart,
}: CameraConnectStepProps) {
	const unusable = status === "EXPIRED" || status === "CLOSED" || Boolean(error);

	// 폰이 붙은 뒤의 QR은 쓸모가 없다. 단계를 늘리는 대신 같은 자리에서
	// "이제 폰에서 찍으세요" 안내로 바꿔 시선을 폰으로 넘긴다.
	if (phoneConnected && !unusable) {
		return (
			<div className="mx-auto flex h-full max-h-[400px] w-full max-w-[700px] flex-col items-center justify-center gap-4 rounded-[16px] bg-white">
				<div className="flex size-[clamp(180px,30vh,270px)] flex-col items-center justify-center gap-4 rounded-[12px] border border-emerald-500/25 bg-emerald-50/50">
					<span className="relative flex size-14 items-center justify-center text-emerald-600">
						<span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/25" />
						<span className="relative flex size-14 items-center justify-center rounded-full bg-white ring-1 ring-emerald-500/25">
							<PhoneIcon />
						</span>
					</span>
					<p className="text-[16px] font-bold text-black/75">폰이 연결됐어요</p>
				</div>
				<StatusPill tone="connected">촬영을 기다리는 중…</StatusPill>
			</div>
		);
	}

	return (
		<div className="mx-auto flex h-full max-h-[400px] w-full max-w-[700px] flex-col items-center justify-center gap-4 rounded-[16px] bg-white">
			<div className="relative flex size-[clamp(180px,30vh,270px)] items-center justify-center rounded-[12px] border border-black/10 p-4">
				{joinUrl ? (
					<QrCode text={joinUrl} size={230} />
				) : (
					<div className="size-full animate-pulse rounded-[8px] bg-black/5" />
				)}

				{/* 만료·오류면 스캔해도 소용없으므로 QR을 덮는다 */}
				{unusable && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[12px] bg-white/85 px-4 text-center backdrop-blur-[2px]">
						<p className="text-[14px] font-semibold text-black/70">
							{error ?? "QR이 만료되었어요"}
						</p>
						<button
							type="button"
							onClick={onRestart}
							className="rounded-full bg-brand px-5 py-2 text-[14px] font-semibold text-white transition hover:brightness-95">
							QR 다시 받기
						</button>
					</div>
				)}
			</div>

			{/* 연결된 경우는 위에서 처리했으므로 여기는 대기 중이거나 끝난 세션이다 */}
			{unusable ? (
				<StatusPill tone="stopped">연결이 종료되었어요</StatusPill>
			) : (
				<StatusPill tone="waiting">폰 연결을 기다리는 중…</StatusPill>
			)}
		</div>
	);
}
