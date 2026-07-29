import { useMemo } from "react";
import { encodeText } from "../../utils/qrcode";

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

export default function CameraConnectStep() {
	// 목업 세션 ID — 이후 POST /simulations/ar-sessions 응답으로 대체
	const sessionId = useMemo(() => {
		const uuid =
			typeof crypto !== "undefined" && "randomUUID" in crypto
				? crypto.randomUUID()
				: Math.random().toString(36).slice(2);
		return uuid.replace(/-/g, "").slice(0, 8);
	}, []);

	// 폰이 QR로 진입할 join 주소
	const joinUrl = useMemo(() => {
		const origin =
			typeof window !== "undefined"
				? window.location.origin
				: "https://starttoo.app";
		return `${origin}/simulations/ar/${sessionId}`;
	}, [sessionId]);

	return (
		<div className="mx-auto flex h-full max-h-[400px] w-full max-w-[700px] flex-col items-center justify-center gap-4 rounded-[16px] bg-white">
			<div className="flex size-[clamp(180px,30vh,270px)] items-center justify-center rounded-[12px] border border-black/10 p-4">
				<QrCode text={joinUrl} size={230} />
			</div>
			<span className="flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-1.5 text-[13px] font-medium text-black/50">
				<span className="size-[7px] animate-pulse rounded-full bg-amber-400" />
				폰 연결을 기다리는 중…
			</span>
		</div>
	);
}
