/* eslint-disable @typescript-eslint/no-explicit-any */
// ⚠️ 임시 테스트 페이지 — 커밋하지 않는다.
// 갤럭시에서 "신체 감지가 안 된다"를 눈으로 확인하려고 만든 것. 로그인 없이
// 열리며, 마커/도안 합성 없이 피부 마스크만 그린다. PC에서 열면 폰으로 바로
// 들어올 수 있는 QR이 뜬다.
import { useEffect, useMemo, useRef, useState } from "react";
import { useCamera } from "../components/simulation/ar-live/useCamera";
import { waitForOpenCv } from "../components/simulation/ar-live/engine/opencv";
import {
	computeSkinMask,
	keepComponentAt,
	skinFraction,
	type SkinMaskInfo,
} from "../components/simulation/ar-live/engine/skinMask";
import {
	loadPersonSegmenter,
	personMaskFromVideo,
} from "../components/simulation/ar-live/engine/personSegmenter";
import { encodeText } from "../utils/qrcode";

const ANALYSIS_MAX_SIDE = 640;
const FRAME_INTERVAL_MS = 200;
/** ArLiveStage가 "피부 있음"으로 판정하는 기준과 같은 값. */
const MIN_SKIN_FRACTION = 0.004;

type Stats = {
	fraction: number;
	rawFraction: number;
	/** 팔로 고른 덩어리의 비율. 기준점을 안 찍었으면 null. */
	componentFraction: number | null;
	maskMs: number;
	skinMs: number;
	personMs: number;
	fps: number;
};

function QrCode({ text, size = 220 }: { text: string; size?: number }) {
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
			aria-label="피부 감지 테스트 페이지 QR">
			<rect width={dim} height={dim} fill="#ffffff" />
			<path d={path} fill="#111111" />
		</svg>
	);
}

export default function SkinDebugPage() {
	const { videoRef, status: cameraStatus, retry } = useCamera();
	const overlayRef = useRef<HTMLCanvasElement>(null);
	const analysisRef = useRef<HTMLCanvasElement>(null);
	const [cvReady, setCvReady] = useState(false);
	const [stats, setStats] = useState<Stats | null>(null);
	const rafRef = useRef<number | null>(null);
	const lastFrameAtRef = useRef(0);
	/** 탭한 지점 (0~1 비율). 마커가 놓일 자리를 손으로 지정하는 용도. */
	const pickRef = useRef<{ x: number; y: number } | null>(null);
	const [picked, setPicked] = useState(false);
	const segmenterRef = useRef<Awaited<
		ReturnType<typeof loadPersonSegmenter>
	> | null>(null);
	const [segmenterState, setSegmenterState] = useState<
		"loading" | "ready" | "unavailable"
	>("loading");

	useEffect(() => {
		let cancelled = false;
		loadPersonSegmenter().then((segmenter) => {
			if (cancelled) return;
			segmenterRef.current = segmenter;
			setSegmenterState(segmenter ? "ready" : "unavailable");
		});
		return () => {
			cancelled = true;
		};
	}, []);

	// QR은 폰이 닿을 수 있는 주소여야 한다. localhost로 열었어도 LAN 주소를 쓴다.
	const joinUrl = useMemo(() => {
		const override = import.meta.env.VITE_AR_JOIN_ORIGIN;
		const origin =
			typeof override === "string" && override.trim()
				? override.trim().replace(/\/+$/, "")
				: window.location.origin;
		return `${origin}/skin-debug`;
	}, []);

	useEffect(() => {
		let cancelled = false;
		waitForOpenCv()
			.then(() => {
				if (!cancelled) setCvReady(true);
			})
			.catch((err) => console.error("[skin-debug] OpenCV init failed", err));
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (cameraStatus !== "active" || !cvReady) return;
		const video = videoRef.current;
		const overlay = overlayRef.current;
		const analysis = analysisRef.current;
		if (!video || !overlay || !analysis) return;
		const overlayContext = overlay.getContext("2d");
		const analysisContext = analysis.getContext("2d", {
			willReadFrequently: true,
		});
		if (!overlayContext || !analysisContext) return;

		let cv: any = null;
		let stopped = false;
		waitForOpenCv().then((ready) => {
			cv = ready;
		});

		function loop() {
			try {
				if (
					cv &&
					video!.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
					video!.videoWidth > 0
				) {
					const now = performance.now();
					if (now - lastFrameAtRef.current >= FRAME_INTERVAL_MS) {
						const elapsed = now - lastFrameAtRef.current;
						lastFrameAtRef.current = now;
						const scale = Math.min(
							1,
							ANALYSIS_MAX_SIDE / Math.max(video!.videoWidth, video!.videoHeight)
						);
						const width = Math.max(1, Math.round(video!.videoWidth * scale));
						const height = Math.max(1, Math.round(video!.videoHeight * scale));
						if (analysis!.width !== width || analysis!.height !== height) {
							analysis!.width = width;
							analysis!.height = height;
							overlay!.width = width;
							overlay!.height = height;
						}
						analysisContext!.drawImage(video!, 0, 0, width, height);
						const source = cv.imread(analysis!);
						const info: SkinMaskInfo = { rawFraction: 0 };
						const startedAt = performance.now();
						const mask = computeSkinMask(cv, source, info);
						const skinMs = performance.now() - startedAt;
						// 실제 AR과 동일하게 인물 분할을 교집합으로 건다.
						const personStartedAt = performance.now();
						const segmenter = segmenterRef.current;
						if (segmenter) {
							const personMask = personMaskFromVideo(
								cv,
								segmenter,
								video!,
								now,
								width,
								height
							);
							if (personMask) {
								try {
									cv.bitwise_and(mask, personMask, mask);
								} finally {
									personMask.delete();
								}
							}
						}
						const personMs = performance.now() - personStartedAt;
						const maskMs = performance.now() - startedAt;
						// 화면을 탭한 지점 = 실제 AR에서 마커가 놓이는 자리. 그 점이
						// 속한 덩어리만 남겨 "팔"로 고르는 동작을 그대로 재현한다.
						const pick = pickRef.current;
						const component = pick
							? keepComponentAt(cv, mask, {
									x: pick.x * width,
									y: pick.y * height,
								})
							: null;
						try {
							const fraction = skinFraction(cv, mask);
							const maskData = mask.data as Uint8Array;
							const componentData = component
								? (component.data as Uint8Array)
								: null;
							// 초록 = 색으로만 잡은 피부, 파랑 = 팔로 고른 덩어리
							const image = overlayContext!.createImageData(width, height);
							for (let index = 0; index < maskData.length; index++) {
								const out = index * 4;
								if (componentData && componentData[index]) {
									image.data[out] = 59;
									image.data[out + 1] = 130;
									image.data[out + 2] = 246;
									image.data[out + 3] = 130;
								} else if (maskData[index]) {
									image.data[out] = 34;
									image.data[out + 1] = 197;
									image.data[out + 2] = 94;
									image.data[out + 3] = 110;
								}
							}
							overlayContext!.putImageData(image, 0, 0);
							setStats({
								fraction,
								rawFraction: info.rawFraction,
								componentFraction: component
									? skinFraction(cv, component)
									: null,
								maskMs,
								skinMs,
								personMs,
								fps: elapsed > 0 ? 1000 / elapsed : 0,
							});
						} finally {
							component?.delete();
							mask.delete();
							source.delete();
						}
					}
				}
			} catch (err) {
				console.error("[skin-debug] frame failed", err);
			}
			if (!stopped) rafRef.current = requestAnimationFrame(loop);
		}
		rafRef.current = requestAnimationFrame(loop);
		return () => {
			stopped = true;
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
		};
	}, [cameraStatus, cvReady, videoRef]);

	const detected = stats ? stats.fraction >= MIN_SKIN_FRACTION : false;

	return (
		<main className="min-h-dvh bg-neutral-950 p-4 text-white">
			<h1 className="mb-3 text-lg font-bold">피부 감지 테스트 (임시)</h1>

			<p className="mx-auto mb-2 w-full max-w-[520px] text-xs text-neutral-400">
				팔 위(마커를 그릴 자리)를 탭하면, 그 점이 속한 덩어리만 파랑으로
				표시됩니다. 실제 AR에서 팔 영역을 고르는 방식과 같습니다.
			</p>

			<div
				className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-xl bg-black"
				onClick={(event) => {
					const rect = event.currentTarget.getBoundingClientRect();
					pickRef.current = {
						x: (event.clientX - rect.left) / rect.width,
						y: (event.clientY - rect.top) / rect.height,
					};
					setPicked(true);
				}}>
				<video
					ref={videoRef}
					autoPlay
					playsInline
					muted
					className="block w-full"
				/>
				<canvas
					ref={overlayRef}
					className="pointer-events-none absolute inset-0 h-full w-full"
				/>
				<canvas ref={analysisRef} className="hidden" aria-hidden />
			</div>

			<div className="mx-auto mt-3 w-full max-w-[520px] rounded-xl bg-neutral-900 p-4 font-mono text-sm leading-relaxed">
				{cameraStatus !== "active" && (
					<p className="mb-2 text-amber-400">
						카메라 상태: {cameraStatus}{" "}
						<button
							type="button"
							onClick={retry}
							className="ml-2 rounded bg-neutral-700 px-2 py-1">
							다시 시도
						</button>
					</p>
				)}
				{!cvReady && <p className="text-neutral-400">OpenCV 로딩 중…</p>}
				{stats && (
					<>
						<p className={detected ? "text-green-400" : "text-red-400"}>
							판정: {detected ? "피부 감지됨 ✅" : "감지 실패 ❌"}
						</p>
						<p>
							최종 비율 : {(stats.fraction * 100).toFixed(2)}% (기준{" "}
							{(MIN_SKIN_FRACTION * 100).toFixed(1)}%)
						</p>
						<p>원본 비율 : {(stats.rawFraction * 100).toFixed(2)}%</p>
						<p className="text-blue-400">
							팔 덩어리 :{" "}
							{stats.componentFraction === null
								? picked
									? "못 찾음 (탭한 곳이 피부로 안 잡힘)"
									: "화면을 탭해서 지정"
								: `${(stats.componentFraction * 100).toFixed(2)}%`}
						</p>
						<p>
							마스크 합계: {stats.maskMs.toFixed(1)}ms · {stats.fps.toFixed(1)}{" "}
							fps
						</p>
						<p className="text-neutral-400">
							└ 피부색 {stats.skinMs.toFixed(1)}ms · 인물분할{" "}
							{stats.personMs.toFixed(1)}ms
						</p>
						<p
							className={
								segmenterState === "ready"
									? "text-neutral-300"
									: "text-amber-400"
							}>
							인물 분할 :{" "}
							{segmenterState === "loading"
								? "모델 받는 중…"
								: segmenterState === "ready"
									? "적용됨"
									: "사용 불가 (피부색만으로 판정)"}
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
