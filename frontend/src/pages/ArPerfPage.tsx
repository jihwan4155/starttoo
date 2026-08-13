// ⚠️ 임시 측정 페이지 — 커밋하지 않는다.
// 실제 AR 파이프라인(ArLiveStage)을 로그인 없이 띄우고 구간별 소요 시간을 보여준다.
// 프레임이 상한(FRAME_INTERVAL_MS)에 막힌 건지, 처리가 느려서인지 구분하는 용도.
import { useCallback, useMemo, useRef, useState } from "react";
import ArLiveStage, {
	type ArEngineOptions,
	type ArFrameTiming,
} from "../components/simulation/ar-live/ArLiveStage";
import octopusDesign from "../assets/ar/design-octopus.png";
import { encodeText } from "../utils/qrcode";

/** ArCustomizeScreen의 기본값을 엔진 단위로 옮긴 것. */
const BASE_SCALE = 4.4;
const OPTIONS: ArEngineOptions = {
	scale: (80 / 100) * BASE_SCALE,
	rotation: 50,
	curvature: 65 / 100,
	opacity: 70 / 100,
};

/** 화면 갱신은 이 간격으로만 — setState를 매 프레임 하면 그게 또 부하가 된다. */
const HUD_INTERVAL_MS = 500;

function QrCode({ text, size = 200 }: { text: string; size?: number }) {
	const modules = useMemo(() => encodeText(text, "M"), [text]);
	const border = 4;
	const dim = modules.length + border * 2;
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
			aria-label="AR 성능 측정 페이지 QR">
			<rect width={dim} height={dim} fill="#ffffff" />
			<path d={path} fill="#111111" />
		</svg>
	);
}

export default function ArPerfPage() {
	const [timing, setTiming] = useState<ArFrameTiming | null>(null);
	const lastShownAtRef = useRef(0);
	// 최근 구간 평균 — 한 프레임 값만 보면 튀어서 판단이 어렵다.
	const bucketRef = useRef<ArFrameTiming[]>([]);

	const handlePerf = useCallback((next: ArFrameTiming) => {
		bucketRef.current.push(next);
		const now = performance.now();
		if (now - lastShownAtRef.current < HUD_INTERVAL_MS) return;
		lastShownAtRef.current = now;
		const bucket = bucketRef.current;
		bucketRef.current = [];
		const mean = (pick: (item: ArFrameTiming) => number) =>
			bucket.reduce((sum, item) => sum + pick(item), 0) / bucket.length;
		setTiming({
			fps: mean((item) => item.fps),
			totalMs: mean((item) => item.totalMs),
			trackMs: mean((item) => item.trackMs),
			concealMs: mean((item) => item.concealMs),
			compositeMs: mean((item) => item.compositeMs),
			maskMs: mean((item) => item.maskMs),
		});
	}, []);

	const joinUrl = useMemo(() => {
		const override = import.meta.env.VITE_AR_JOIN_ORIGIN;
		const origin =
			typeof override === "string" && override.trim()
				? override.trim().replace(/\/+$/, "")
				: window.location.origin;
		return `${origin}/ar-perf`;
	}, []);

	return (
		<main className="min-h-dvh bg-neutral-950 p-3 text-white">
			<h1 className="mb-2 text-base font-bold">AR 성능 측정 (임시)</h1>

			<ArLiveStage
				designUrl={octopusDesign}
				options={OPTIONS}
				onCapture={() => {}}
				onPerf={handlePerf}
			/>

			<div className="mx-auto mt-3 w-full max-w-[520px] rounded-xl bg-neutral-900 p-4 font-mono text-sm leading-relaxed">
				{!timing ? (
					<p className="text-neutral-400">측정 대기 중… (카메라를 켜세요)</p>
				) : (
					<>
						<p
							className={
								timing.fps >= 11
									? "text-green-400"
									: timing.fps >= 7
										? "text-amber-400"
										: "text-red-400"
							}>
							실제 프레임 : {timing.fps.toFixed(1)} fps (상한 12.5)
						</p>
						<p>프레임 처리 : {timing.totalMs.toFixed(1)}ms</p>
						<p className="text-neutral-400">
							├ 마커 추적 : {timing.trackMs.toFixed(1)}ms
						</p>
						<p className="text-neutral-400">
							├ 마커 지우기: {timing.concealMs.toFixed(1)}ms
						</p>
						<p className="text-neutral-400">
							├ 도안 합성 : {timing.compositeMs.toFixed(1)}ms
						</p>
						<p className="text-neutral-400">
							└ 마스크(평균): {timing.maskMs.toFixed(1)}ms
						</p>
						<p className="mt-2 text-xs text-neutral-500">
							fps가 12.5에 붙어 있으면 상한이 병목 → 간격을 줄이면 바로
							빨라집니다. 12.5보다 한참 낮으면 위 구간 중 큰 쪽을 깎아야
							합니다. 마스크는 320ms마다만 돌아서 평균이 낮게 나옵니다.
						</p>
					</>
				)}
			</div>

			<div className="mx-auto mt-4 flex w-full max-w-[520px] flex-col items-center gap-2 rounded-xl bg-white p-4 text-neutral-900">
				<p className="text-sm font-semibold">폰으로 열기</p>
				<QrCode text={joinUrl} />
				<p className="break-all text-center text-xs text-neutral-600">
					{joinUrl}
				</p>
			</div>
		</main>
	);
}
