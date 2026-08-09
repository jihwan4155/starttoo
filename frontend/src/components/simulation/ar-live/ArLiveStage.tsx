/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useCamera, type CameraStatus } from "./useCamera";
import { waitForOpenCv } from "./engine/opencv";
import { SmileMarkerTracker } from "./engine/smileMarkerTracker";
import {
	computeSkinMask,
	estimateLocalSkinAxisAngleDeg,
	keepComponentAt,
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
import {
	loadPersonSegmenter,
	personMaskFromVideo,
} from "./engine/personSegmenter";
// 도안은 MinIO 공개 호스트에서 오는 교차 출처 이미지다. 여기서 예전처럼 image.src 로
// 바로 받으면 캔버스가 오염돼 cv.imread 가 SecurityError 로 죽는다 (AR 도안 로드 실패).
import { loadImage } from "../loadImage";

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

/** 한 프레임을 처리하는 데 걸린 구간별 시간 (ms). */
export type ArFrameTiming = {
	/** 실제로 처리한 프레임 기준 초당 횟수. */
	fps: number;
	/** 프레임 전체 처리 시간. */
	totalMs: number;
	/** 마커 추적. */
	trackMs: number;
	/** 마커 지우기(inpaint). */
	concealMs: number;
	/** 도안 합성 + 피부 클리핑. */
	compositeMs: number;
	/** 피부 마스크 + 인물 분할. 이 프레임에서 안 돌았으면 0. */
	maskMs: number;
};

type ArLiveStageProps = {
	/** 합성할 도안 이미지 URL */
	designUrl: string;
	options: ArEngineOptions;
	/** 캡처 시 합성된 화면의 dataURL 전달 */
	onCapture: (dataUrl: string) => void;
	/**
	 * 구간별 성능 측정 훅. 넘기지 않으면 구간 계측을 아예 하지 않으므로
	 * 평소 비용은 없다 (프레임 간격 조절에 쓰는 전체 시간만 잰다).
	 */
	onPerf?: (timing: ArFrameTiming) => void;
};

const ANALYSIS_MAX_SIDE = 640;
// 프레임 간격은 고정값이 아니라 직전 처리 시간에 맞춰 조절한다. 고정 80ms는
// 빠른 기기에서 12.5fps로 천장을 씌우고, 느린 기기에서는 처리가 주기를 넘겨
// 루프가 포화됐다. 아래 범위 안에서 "처리 시간 × 1.25"를 목표로 삼아,
// 여유가 있으면 더 자주 돌고 벅차면 스스로 물러난다.
const MIN_FRAME_INTERVAL_MS = 40; // 25fps 상한
const MAX_FRAME_INTERVAL_MS = 120; // 8.3fps 하한
const INITIAL_FRAME_INTERVAL_MS = 80;
const SKIN_MASK_INTERVAL_MS = 320;
// 인물 분할은 피부 마스크보다 뜸하게 돌린다. 사람은 천천히 움직이는 데다,
// 둘을 같은 프레임에서 함께 돌리면 그 프레임만 크게 튀어 화면이 걸린다.
const PERSON_MASK_INTERVAL_MS = 640;
const MIN_SKIN_FRACTION = 0.004;

const CAMERA_MESSAGE: Partial<Record<CameraStatus, string>> = {
	requesting: "카메라를 켜는 중…",
	denied: "카메라 권한이 필요해요. 브라우저 설정에서 허용해 주세요.",
	unsupported: "HTTPS(보안 연결)에서만 카메라를 켤 수 있어요.",
	error: "카메라를 열 수 없어요.",
};

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

/**
 * 검출용 피부 마스크는 팔 실루엣의 Canny 엣지를 배제하려고 일부러 안쪽으로
 * erode 되어 있다(skinMask.ts 참고). 그 마스크를 합성 클리핑에 그대로 쓰면
 * 팔 가장자리 쪽 도안이 잘려나가므로, 그릴 때 쓰는 마스크는 다시 부풀린다.
 * erode 폭(7)보다 조금 크게 잡아 실루엣 바로 바깥까지 덮고, 뒤이은 블러가
 * 경계를 흐려 배경으로 새는 부분은 눈에 띄지 않는다.
 */
const RENDER_MASK_DILATE_SIZE = 13;

function updateSkinAlphaCanvas(
	cv: any,
	mask: any,
	existing: HTMLCanvasElement | null
): HTMLCanvasElement {
	const canvas = ensureCanvas(existing, mask.cols, mask.rows);
	const context = canvas.getContext("2d");
	if (!context) return canvas;
	const feathered = new cv.Mat();
	const expanded = new cv.Mat();
	let dilateKernel: any = null;
	try {
		dilateKernel = cv.getStructuringElement(
			cv.MORPH_ELLIPSE,
			new cv.Size(RENDER_MASK_DILATE_SIZE, RENDER_MASK_DILATE_SIZE)
		);
		cv.dilate(mask, expanded, dilateKernel);
		cv.GaussianBlur(expanded, feathered, new cv.Size(11, 11), 0);
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
		expanded.delete();
		dilateKernel?.delete();
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
	onPerf,
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
	// 마커 중심 — 피부 마스크에서 "팔인 덩어리"를 고르는 기준점
	const lastMarkerCenterRef = useRef<{ x: number; y: number } | null>(null);
	// 인물 분할기. 못 받으면 null로 남고 피부 마스크만으로 동작한다.
	const personSegmenterRef = useRef<Awaited<
		ReturnType<typeof loadPersonSegmenter>
	> | null>(null);
	const rafIdRef = useRef<number | null>(null);
	const lastFrameAtRef = useRef(0);
	const frameIntervalRef = useRef(INITIAL_FRAME_INTERVAL_MS);
	const lastSkinMaskAtRef = useRef(0);
	// 직전 인물 분할 결과. 피부 마스크보다 뜸하게 갱신하고 그 사이엔 재사용한다.
	const personMaskRef = useRef<any>(null);
	const lastPersonMaskAtRef = useRef(0);
	const lastArmAxisAtRef = useRef(0);
	const trackingRef = useRef<TrackingState>("loading");
	const skinVisibleRef = useRef(false);
	const optionsRef = useRef(options);
	// 렌더 루프가 매번 새로 만들어지지 않도록 콜백은 ref로 들고 있는다.
	const onPerfRef = useRef(onPerf);
	onPerfRef.current = onPerf;

	useEffect(() => {
		optionsRef.current = options;
		// 회전/도안이 바뀌면 포즈 스무딩을 리셋해 튀는 것을 방지
		poseStabilizerRef.current.reset();
	}, [options]);

	// 인물 분할기 로드 — 실패해도 AR은 그대로 동작한다.
	useEffect(() => {
		let cancelled = false;
		loadPersonSegmenter().then((segmenter) => {
			if (!cancelled) personSegmenterRef.current = segmenter;
		});
		return () => {
			cancelled = true;
		};
	}, []);

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
					if (now - lastFrameAtRef.current < frameIntervalRef.current) {
						rafIdRef.current = requestAnimationFrame(renderLoop);
						return;
					}
					const sinceLastFrame = now - lastFrameAtRef.current;
					lastFrameAtRef.current = now;
					// onPerf가 없으면 구간별 measure* 는 전부 0으로 남고 콜백도 안 부른다.
					// 전체 처리 시간은 간격 조절에 필요하므로 항상 잰다 (호출 두 번).
					const measuring = Boolean(onPerfRef.current);
					const stamp = () => (measuring ? performance.now() : 0);
					const frameStartedAt = performance.now();
					let maskMs = 0;
					let trackMs = 0;
					let concealMs = 0;
					let compositeMs = 0;

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
						// 캐시해 둔 인물 마스크는 이전 해상도 기준이라 못 쓴다.
						personMaskRef.current?.delete();
						personMaskRef.current = null;
						lastPersonMaskAtRef.current = 0;
						skinAlphaCanvasRef.current = null;
						skinOutlineRef.current = null;
					}

					analysisContext!.drawImage(video!, 0, 0, width, height);
					overlayContext!.clearRect(0, 0, width, height);
					const src = cv.imread(analysisCanvas);
					const gray = new cv.Mat();

					try {
						if (now - lastSkinMaskAtRef.current >= SKIN_MASK_INTERVAL_MS) {
							const maskStartedAt = stamp();
							lastSkinMaskAtRef.current = now;
							const nextSkinMask = computeSkinMask(cv, src);
							// 인물 분할과 교집합. 색만 보면 따뜻한 흰 벽·나무 책상이
							// 피부로 잡히고, MORPH_CLOSE가 그 배경을 팔에 이어붙여
							// 덩어리 필터까지 무력화된다. 사람/배경을 직접 가르는
							// 마스크를 곱해 그 경로를 끊는다.
							const segmenter = personSegmenterRef.current;
							if (
								segmenter &&
								now - lastPersonMaskAtRef.current >= PERSON_MASK_INTERVAL_MS
							) {
								lastPersonMaskAtRef.current = now;
								const nextPersonMask = personMaskFromVideo(
									cv,
									segmenter,
									video!,
									now,
									width,
									height
								);
								if (nextPersonMask) {
									personMaskRef.current?.delete();
									personMaskRef.current = nextPersonMask;
								}
							}
							// 크기가 안 맞으면(해상도 변경 직후) 버리고 다음 갱신을 기다린다.
							const personMask = personMaskRef.current;
							if (
								personMask &&
								personMask.rows === nextSkinMask.rows &&
								personMask.cols === nextSkinMask.cols
							) {
								cv.bitwise_and(nextSkinMask, personMask, nextSkinMask);
							}
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
								// 검출용 마스크는 전체를 유지한다 — 최초 락 전에는
								// 마커가 어디 있는지 모르므로 탐색 범위를 좁히면 안 된다.
								skinMaskRef.current = hasSkin ? nextSkinMask.clone() : null;
								// 합성 클리핑용 마스크는 마커가 올라가 있는 덩어리만
								// 남긴다. 색이 피부와 겹치는 배경(따뜻한 흰 벽, 나무
								// 책상, 살구빛 옷)은 팔과 이어져 있지 않아 통째로
								// 떨어져 나가고, 팔은 한 덩어리라 줄어들지 않는다.
								let renderMask = nextSkinMask;
								let isolated: any = null;
								const markerCenter = lastMarkerCenterRef.current;
								if (hasSkin && markerCenter) {
									isolated = keepComponentAt(cv, nextSkinMask, markerCenter);
									if (isolated) renderMask = isolated;
								}
								try {
									skinAlphaCanvasRef.current = hasSkin
										? updateSkinAlphaCanvas(
												cv,
												renderMask,
												skinAlphaCanvasRef.current
											)
										: null;
								} finally {
									isolated?.delete();
								}
								skinOutlineRef.current = hasSkin
									? largestSkinOutline(cv, nextSkinMask)
									: null;
								if (!hasSkin) armAxisAngleRef.current = null;
								setSkin(hasSkin);
							} finally {
								nextSkinMask.delete();
							}
							maskMs = measuring ? performance.now() - maskStartedAt : 0;
						}

						const trackStartedAt = stamp();
						cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
						const skinMask = skinMaskRef.current;
						const searchContext = skinMask
							? { region: null, skinMask, allowUnmaskedFallback: true }
							: null;
						const canProcess = skinMask || !tracker!.needsExternalSearch();
						const result = canProcess
							? tracker!.process(gray, now / 1000, searchContext)
							: null;
						trackMs = measuring ? performance.now() - trackStartedAt : 0;

						if (result && designMatRef.current) {
							setTrackingState("tracking");
							const concealStartedAt = stamp();
							// 마커가 찍힌 곳은 반드시 팔이다. 다음 피부 마스크 갱신 때
							// 어느 덩어리가 팔인지 고르는 기준으로 쓴다.
							lastMarkerCenterRef.current = {
								x:
									(result.points.topLeft.x +
										result.points.topRight.x +
										result.points.bottomRight.x +
										result.points.bottomLeft.x) /
									4,
								y:
									(result.points.topLeft.y +
										result.points.topRight.y +
										result.points.bottomRight.y +
										result.points.bottomLeft.y) /
									4,
							};
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
							concealMs = measuring
								? performance.now() - concealStartedAt
								: 0;
							// 마스크가 화면을 이만큼 덮으면 팔이 아니라 배경까지 피부로
							// 잡힌 것이다. 그 마스크로 팔 축을 추정하면 각도가 프레임마다
							// 튀어 타투가 혼자 도니, 차라리 마커 자체 각도를 쓴다.
							if (skinMask && skinFraction(cv, skinMask) > 0.55) {
								armAxisAngleRef.current = null;
							} else if (
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
							const compositeStartedAt = stamp();
							const opts = optionsRef.current;
							const stabilized = poseStabilizer.update(
								result.points,
								armAxisAngleRef.current,
								opts.rotation,
								now
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
							compositeMs = measuring
								? performance.now() - compositeStartedAt
								: 0;
						} else {
							setTrackingState("searching");
							// 추적을 놓치면 기준점도 버린다. 팔이 화면을 벗어난 뒤에도
							// 옛 좌표를 들고 있으면 엉뚱한 덩어리를 팔로 고르게 된다.
							lastMarkerCenterRef.current = null;
						}
						if (!result)
							drawSkinOutline(overlayContext!, skinOutlineRef.current);
					} finally {
						src.delete();
						gray.delete();
					}

					const processMs = performance.now() - frameStartedAt;
					// 처리 시간의 1.25배를 다음 간격으로 삼아 25% 여유를 남긴다.
					// 여유가 없으면 rAF·UI·터치 반응이 같이 죽는다. 급변을 막으려
					// 이전 값과 섞어 서서히 수렴시킨다.
					frameIntervalRef.current = Math.min(
						MAX_FRAME_INTERVAL_MS,
						Math.max(
							MIN_FRAME_INTERVAL_MS,
							frameIntervalRef.current * 0.7 + processMs * 1.25 * 0.3
						)
					);

					if (measuring) {
						onPerfRef.current?.({
							fps: sinceLastFrame > 0 ? 1000 / sinceLastFrame : 0,
							totalMs: processMs,
							trackMs,
							concealMs,
							compositeMs,
							maskMs,
						});
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
			personMaskRef.current?.delete();
			personMaskRef.current = null;
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
