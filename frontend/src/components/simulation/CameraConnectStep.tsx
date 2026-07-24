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
	// 스캔 시 현재 서비스의 AR 시뮬레이션 페이지로 접속되도록 인코딩
	const arUrl = useMemo(() => {
		const origin =
			typeof window !== "undefined"
				? window.location.origin
				: "https://starttoo.app";
		return `${origin}/simulations?mode=ar`;
	}, []);

	return (
		<div className="mx-auto flex h-full max-h-[400px] w-full max-w-[700px] items-center justify-center rounded-[16px] bg-white">
			<div className="flex size-[clamp(180px,30vh,270px)] items-center justify-center rounded-[12px] border border-black/10 p-4">
				<QrCode text={arUrl} size={230} />
			</div>
		</div>
	);
}
