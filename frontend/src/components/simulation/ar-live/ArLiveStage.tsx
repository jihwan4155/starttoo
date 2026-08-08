/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useCamera, type CameraStatus } from "./useCamera";
import { waitForOpenCv } from "./engine/opencv";
import { SmileMarkerTracker } from "./engine/smileMarkerTracker";
import {
	computeSkinMask,
	estimateLocalSkinAxisAngleDeg,
	largestSkinOutline,
	skinFraction,
	type OutlinePoint,
} from "./engine/skinMask";
import {
	concealSmileMarkerArea,
	concealSmileMarkerInpaint,
	compositeDesignCurvedOntoCanvas,
	designImageToMat,
} from "./engine/perspectiveComposite";
import { TattooPoseStabilizer } from "./engine/tattooPoseStabilizer";

/** 엔진 네이티브 옵션값 (슬라이더 %가 아니라 실제 엔진 단위) */
export type ArEngineOptions = {
	/** 마커 quad 대비 도안 배율 (PoC 기본 4.4) */
	scale: number;
	/** 도안 회전(도) */
	rotation: number;
	/** 곡률 0~1.15 */
	curvature: number;
	/** 농도 0.2~1 */
	opacity: number;
};

type TrackingState = "loading" | "searching" | "tracking";

type ArLiveStageProps = {
	/** 합성할 도안 이미지 URL */
	designUrl: string;
	options: ArEngineOptions;
	/** 캡처 시 합성된 화면의 dataURL 전달 */
	onCapture: (dataUrl: string) => void;
};

const ANALYSIS_MAX_SIDE = 640;
const FRAME_INTERVAL_MS = 80;
const SKIN_MASK_INTERVAL_MS = 320;
const MIN_SKIN_FRACTION = 0.004;

const CAMERA_MESSAGE: Partial<Record<CameraStatus, string>> = {
	requesting: "카메라를 켜는 중…",
	denied: "카메라 권한이 필요해요. 브라우저 설정에서 허용해 주세요.",
	unsupported: "HTTPS(보안 연결)에서만 카메라를 켤 수 있어요.",
	error: "카메라를 열 수 없어요.",
};

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = reject;
		image.src = url;
	});
}

function ensureCanvas(
	canvas: HTMLCanvasElement | null,
	width: number,
	height: number
): HTMLCanvasElement {
	const target = canvas ?? document.createElement("canvas");
	if (target.width !== width || target.height !== height) {
		target.width = width;
		target.height = height;
	}
	return target;
}

function updateSkinAlphaCanvas(
	cv: any,
	mask: any,
	existing: HTMLCanvasElement | null
): HTMLCanvasElement {
	const canvas = ensureCanvas(existing, mask.cols, mask.rows);
	const context = canvas.getContext("2d");
	if (!context) return canvas;
	const feathered = new cv.Mat();
	try {
		cv.GaussianBlur(mask, feathered, new cv.Size(11, 11), 0);
		const image = context.createImageData(mask.cols, mask.rows);
		const alpha = feathered.data as Uint8Array;
		for (let index = 0; index < alpha.length; index++) {
			const outputIndex = index * 4;
			image.data[outputIndex] = 255;
			image.data[outputIndex + 1] = 255;
			image.data[outputIndex + 2] = 255;
			image.data[outputIndex + 3] = alpha[index];
		}
		context.putImageData(image, 0, 0);
		return canvas;
	} finally {
		feathered.delete();
	}
}

function drawSkinOutline(
	context: CanvasRenderingContext2D,
	outline: OutlinePoint[] | null
): void {
	if (!outline || outline.length < 3) return;
	context.save();
	context.beginPath();
	context.moveTo(outline[0].x, outline[0].y);
	for (let index = 1; index < outline.length; index++) {
		context.lineTo(outline[index].x, outline[index].y);
	}
	context.closePath();
	context.setLineDash([8, 7]);
	context.lineDashOffset = -performance.now() / 90;
	context.lineWidth = 2.5;
	context.strokeStyle = "rgba(56, 189, 248, 0.95)";
	context.stroke();
	context.restore();
}

/**
 * 폰 로컬에서 도는 실시간 AR 스테이지 — 카메라 + 스마일 마커 트래킹 + 곡률 합성.
 * PoC PhonePage 렌더 루프를 소켓/공유도안 제거하고 이식했다.
 */
export default function ArLiveStage({
	designUrl,
	options,
	onCapture,
}: ArLiveStageProps) {
	const { videoRef, status: cameraStatus, retry } = useCamera();
	const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
	const analysisCanvasRef = useRef<HTMLCanvasElement>(null);
	const [cvReady, setCvReady] = useState(false);
	const [tracking, setTracking] = useState<TrackingState>("loading");
	const [skinVisible, setSkinVisible] = useState(false);
	const [aspectRatio, setAspectRatio] = useState("3 / 4");

	const cvRef = useRef<any>(null);
	const trackerRef = useRef<SmileMarkerTracker | null>(null);
	const poseStabilizerRef = useRef(new TattooPoseStabilizer());
	const designMatRef = useRef<any>(null);
	const skinMaskRef = useRef<any>(null);
	// 넓은 피부에서 뽑아 시간축으로 안정화한 대표 피부색 (마커 옆 잉크 헐로 오염 방지)
	const skinColorRef = useRef<[number, number, number] | null>(null);
	const skinAlphaCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const skinOutlineRef = useRef<OutlinePoint[] | null>(null);
	const tattooLayerCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const armAxisAngleRef = useRef<number | null>(null);
	const rafIdRef = useRef<number | null>(null);
	const lastFrameAtRef = useRef(0);
	const lastSkinMaskAtRef = useRef(0);
	const lastArmAxisAtRef = useRef(0);
	const trackingRef = useRef<TrackingState>("loading");
	const skinVisibleRef = useRef(false);
	const optionsRef = useRef(options);

	useEffect(() => {
		optionsRef.current = options;
		// 회전/도안이 바뀌면 포즈 스무딩을 리셋해 튀는 것을 방지
		poseStabilizerRef.current.reset();
	}, [options]);

	// OpenCV 초기화 + 트래커 생성
	useEffect(() => {
		let cancelled = false;
		waitForOpenCv()
			.then((cv) => {
				if (cancelled) return;
				cvRef.current = cv;
				trackerRef.current = new SmileMarkerTracker(cv);
				setCvReady(true);
				setTracking("searching");
				trackingRef.current = "searching";
			})
			.catch((err) => {
				console.error("[ar-live] OpenCV init failed", err);
			});
		const poseStabilizer = poseStabilizerRef.current;
		return () => {
			cancelled = true;
			if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
			trackerRef.current?.release();
			trackerRef.current = null;
			skinMaskRef.current?.delete();
			skinMaskRef.current = null;
			poseStabilizer.reset();
			designMatRef.current?.delete();
			designMatRef.current = null;
		};
	}, []);

	// 선택된 도안을 cv.Mat으로 변환
	useEffect(() => {
		let cancelled = false;
		waitForOpenCv()
			.then((cv) => loadImage(designUrl).then((img) => ({ cv, img })))
			.then(({ cv, img }) => {
				if (cancelled) return;
				const nextMat = designImageToMat(cv, img);
				designMatRef.current?.delete();
				designMatRef.current = nextMat;
			})
			.catch((err) => console.error("[ar-live] design load failed", err));
		return () => {
			cancelled = true;
		};
	}, [designUrl]);

	// 렌더 루프
	useEffect(() => {
		if (cameraStatus !== "active" || !cvReady) return;
		const video = videoRef.current;
		const overlayCanvas = overlayCanvasRef.current;
		const analysisCanvas = analysisCanvasRef.current;
		const cv = cvRef.current;
		const tracker = trackerRef.current;
		if (!video || !overlayCanvas || !analysisCanvas || !cv || !tracker) return;

		const overlayContext = overlayCanvas.getContext("2d", {
			willReadFrequently: true,
		});
		const analysisContext = analysisCanvas.getContext("2d", {
			willReadFrequently: true,
		});
		if (!overlayContext || !analysisContext) return;
		const poseStabilizer = poseStabilizerRef.current;

		if (video.videoWidth > 0 && video.videoHeight > 0) {
			setAspectRatio(`${video.videoWidth} / ${video.videoHeight}`);
		}

		function setTrackingState(next: TrackingState) {
			if (trackingRef.current !== next) {
				trackingRef.current = next;
				setTracking(next);
			}
		}
		function setSkin(next: boolean) {
			if (skinVisibleRef.current === next) return;
			skinVisibleRef.current = next;
			setSkinVisible(next);
		}

		function renderLoop() {
			try {
				if (
					video!.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
					video!.videoWidth > 0 &&
					video!.videoHeight > 0
				) {
					const now = performance.now();
					if (now - lastFrameAtRef.current < FRAME_INTERVAL_MS) {
						rafIdRef.current = requestAnimationFrame(renderLoop);
						return;
					}
					lastFrameAtRef.current = now;

					const analysisScale = Math.min(
						1,
						ANALYSIS_MAX_SIDE / Math.max(video!.videoWidth, video!.videoHeight)
					);
					const width = Math.max(
						1,
						Math.round(video!.videoWidth * analysisScale)
					);
					const height = Math.max(
						1,
						Math.round(video!.videoHeight * analysisScale)
					);
					if (
						overlayCanvas!.width !== width ||
						overlayCanvas!.height !== height ||
						analysisCanvas!.width !== width ||
						analysisCanvas!.height !== height
					) {
						overlayCanvas!.width = width;
						overlayCanvas!.height = height;
						analysisCanvas!.width = width;
						analysisCanvas!.height = height;
						tracker!.reset();
						poseStabilizer.reset();
						skinMaskRef.current?.delete();
						skinMaskRef.current = null;
						skinAlphaCanvasRef.current = null;
						skinOutlineRef.current = null;
					}

					analysisContext!.drawImage(video!, 0, 0, width, height);
					overlayContext!.clearRect(0, 0, width, height);
					const src = cv.imread(analysisCanvas);
					const gray = new cv.Mat();

					try {
						if (now - lastSkinMaskAtRef.current >= SKIN_MASK_INTERVAL_MS) {
							lastSkinMaskAtRef.current = now;
							const nextSkinMask = computeSkinMask(cv, src);
							try {
								const hasSkin =
									skinFraction(cv, nextSkinMask) >= MIN_SKIN_FRACTION;
								if (hasSkin) {
									// 마스크된 피부 픽셀 평균색 → EMA로 안정화
									const m = cv.mean(src, nextSkinMask);
									const prev = skinColorRef.current;
									const k = prev ? 0.3 : 1;
									skinColorRef.current = [
										(prev?.[0] ?? m[0]) + (m[0] - (prev?.[0] ?? m[0])) * k,
										(prev?.[1] ?? m[1]) + (m[1] - (prev?.[1] ?? m[1])) * k,
										(prev?.[2] ?? m[2]) + (m[2] - (prev?.[2] ?? m[2])) * k,
									];
								} else {
									skinColorRef.current = null;
								}
								skinMaskRef.current?.delete();
								skinMaskRef.current = hasSkin ? nextSkinMask.clone() : null;
								skinAlphaCanvasRef.current = hasSkin
									? updateSkinAlphaCanvas(
											cv,
											nextSkinMask,
											skinAlphaCanvasRef.current
										)
									: null;
								skinOutlineRef.current = hasSkin
									? largestSkinOutline(cv, nextSkinMask)
									: null;
								if (!hasSkin) armAxisAngleRef.current = null;
								setSkin(hasSkin);
							} finally {
								nextSkinMask.delete();
							}
						}

						cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
						const skinMask = skinMaskRef.current;
						const searchContext = skinMask
							? { region: null, skinMask, allowUnmaskedFallback: true }
							: null;
						const canProcess = skinMask || !tracker!.needsExternalSearch();
						const result = canProcess
							? tracker!.process(gray, now / 1000, searchContext)
							: null;

						if (result && designMatRef.current) {
							setTrackingState("tracking");
							// 마커가 감싸는 영역을 마스크로 잡고 cv.inpaint로 주변 피부에서
							// 복원한다. 실패하면 기존 방식(옆 피부 이식 + 방사형 페이드)으로
							// 되돌아가므로 최악의 경우에도 이전 동작이 유지된다.
							concealSmileMarkerInpaint(
								cv,
								overlayContext!,
								result.features,
								analysisContext!,
								() =>
									concealSmileMarkerArea(
										overlayContext!,
										result.features,
										analysisContext!,
										skinColorRef.current,
										armAxisAngleRef.current
									)
							);
							if (
								skinMask &&
								now - lastArmAxisAtRef.current >= SKIN_MASK_INTERVAL_MS
							) {
								lastArmAxisAtRef.current = now;
								const corners = [
									result.points.topLeft,
									result.points.topRight,
									result.points.bottomRight,
									result.points.bottomLeft,
								];
								const center = {
									x: corners.reduce((s, p) => s + p.x, 0) / 4,
									y: corners.reduce((s, p) => s + p.y, 0) / 4,
								};
								const size =
									corners.reduce((s, p, i) => {
										const n = corners[(i + 1) % corners.length];
										return s + Math.hypot(n.x - p.x, n.y - p.y);
									}, 0) / 4;
								armAxisAngleRef.current =
									estimateLocalSkinAxisAngleDeg(
										cv,
										skinMask,
										center,
										Math.max(size * 2.6, Math.min(width, height) * 0.16)
									) ?? armAxisAngleRef.current;
							}
							const opts = optionsRef.current;
							const stabilized = poseStabilizer.update(
								result.points,
								armAxisAngleRef.current,
								opts.rotation
							);
							const tattooLayer = ensureCanvas(
								tattooLayerCanvasRef.current,
								width,
								height
							);
							tattooLayerCanvasRef.current = tattooLayer;
							const tctx = tattooLayer.getContext("2d");
							if (tctx) {
								tctx.setTransform(1, 0, 0, 1, 0, 0);
								tctx.clearRect(0, 0, width, height);
								compositeDesignCurvedOntoCanvas(
									cv,
									tctx,
									designMatRef.current,
									stabilized,
									{
										scale: opts.scale,
										opacity: opts.opacity,
										curvature: opts.curvature,
									}
								);
								if (skinAlphaCanvasRef.current) {
									tctx.save();
									tctx.setTransform(1, 0, 0, 1, 0, 0);
									tctx.globalCompositeOperation = "destination-in";
									tctx.filter = "none";
									tctx.globalAlpha = 1;
									tctx.drawImage(skinAlphaCanvasRef.current, 0, 0);
									tctx.restore();
								}
								overlayContext!.drawImage(tattooLayer, 0, 0);
							}
						} else {
							setTrackingState("searching");
						}
						if (!result)
							drawSkinOutline(overlayContext!, skinOutlineRef.current);
					} finally {
						src.delete();
						gray.delete();
					}
				}
			} catch (err) {
				console.error("[ar-live] frame failed", err);
				tracker!.reset();
				poseStabilizer.reset();
				setTrackingState("searching");
			}
			rafIdRef.current = requestAnimationFrame(renderLoop);
		}

		rafIdRef.current = requestAnimationFrame(renderLoop);
		return () => {
			if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
			rafIdRef.current = null;
			tracker!.reset();
			poseStabilizer.reset();
			skinMaskRef.current?.delete();
			skinMaskRef.current = null;
			skinAlphaCanvasRef.current = null;
			skinOutlineRef.current = null;
		};
	}, [cameraStatus, cvReady, videoRef]);

	function handleCapture() {
		const video = videoRef.current;
		const overlay = overlayCanvasRef.current;
		if (!video || !video.videoWidth) return;
		try {
			const out = document.createElement("canvas");
			out.width = video.videoWidth;
			out.height = video.videoHeight;
			const ctx = out.getContext("2d");
			if (!ctx) return;
			ctx.drawImage(video, 0, 0, out.width, out.height);
			if (overlay) ctx.drawImage(overlay, 0, 0, out.width, out.height);
			onCapture(out.toDataURL("image/png"));
		} catch (err) {
			console.error("[ar-live] capture failed", err);
		}
	}

	const statusText =
		cameraStatus !== "active"
			? (CAMERA_MESSAGE[cameraStatus] ?? "카메라 준비 중…")
			: !cvReady
				? "인식 엔진 준비 중…"
				: tracking === "tracking"
					? "마커 인식됨"
					: skinVisible
						? "점선 안에 마커를 맞춰주세요"
						: "팔을 가까이 비춰주세요";

	return (
		<div
			className="relative mx-auto w-full overflow-hidden rounded-[16px] bg-black lg:max-w-[320px]"
			style={{ aspectRatio }}>
			<video
				ref={videoRef}
				playsInline
				muted
				className={`size-full object-cover ${
					cameraStatus === "active" ? "" : "hidden"
				}`}
			/>
			<canvas
				ref={overlayCanvasRef}
				className="pointer-events-none absolute inset-0 size-full object-cover"
			/>
			<canvas ref={analysisCanvasRef} className="hidden" aria-hidden />

			{cameraStatus === "active" && (
				<span className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[13px] font-semibold text-brand">
					<span className="size-[6px] animate-pulse rounded-full bg-brand" />
					LIVE
				</span>
			)}
			<span className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-semibold text-white">
				부위 · 팔
			</span>

			<span className="absolute inset-x-0 bottom-20 z-10 text-center text-[12px] font-light text-white/80">
				{statusText}
			</span>

			{(cameraStatus === "denied" || cameraStatus === "error") && (
				<button
					type="button"
					onClick={retry}
					className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15 px-4 py-1.5 text-[13px] font-semibold text-white">
					다시 시도
				</button>
			)}

			<button
				type="button"
				onClick={handleCapture}
				disabled={cameraStatus !== "active"}
				aria-label="사진 촬영"
				className="absolute bottom-4 left-1/2 z-10 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-black text-white shadow-lg ring-4 ring-white/40 transition active:scale-95 disabled:opacity-40 lg:bg-white lg:text-black">
				<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
					<path
						d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
						stroke="currentColor"
						strokeWidth="1.6"
						strokeLinejoin="round"
					/>
					<circle
						cx="12"
						cy="13.5"
						r="3.2"
						stroke="currentColor"
						strokeWidth="1.6"
					/>
				</svg>
			</button>
		</div>
	);
}
