import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
	type PointerEvent as ReactPointerEvent,
} from "react";
import {
	createDepthPreview,
	distance,
	estimateDepth,
	getOverlayGeometry,
	isPersonPathContinuous,
	isPointInsidePerson,
	removeTattooBackground,
	renderScene,
	segmentPerson,
	type DepthMap,
	type PersonMask,
	type TattooTransform,
} from "./inkproof/image-engine";

type StageState = "wait" | "busy" | "done" | "error";

type PipelineStage = {
	id: "design" | "mask" | "depth";
	label: string;
	state: StageState;
	detail: string;
	progress: number;
};

type InteractionMode = "idle" | "drag" | "scale" | "rotate";

type PointerSession = {
	mode: InteractionMode;
	startPoint: { x: number; y: number };
	startTransform: TattooTransform;
	lastTransform: TattooTransform;
	startDistance: number;
	startAngle: number;
};

type Simulation3DStepProps = {
	designUrl: string | null;
	photoUrl: string | null;
};

const INITIAL_TRANSFORM: TattooTransform = {
	x: 0.5,
	y: 0.52,
	width: 0.3,
	rotation: 0,
};

const INITIAL_CLIP_ANCHOR = {
	x: INITIAL_TRANSFORM.x,
	y: INITIAL_TRANSFORM.y,
};

const EMPTY_POINTER_SESSION: PointerSession = {
	mode: "idle",
	startPoint: { x: 0, y: 0 },
	startTransform: INITIAL_TRANSFORM,
	lastTransform: INITIAL_TRANSFORM,
	startDistance: 0,
	startAngle: 0,
};

const INITIAL_STAGES: PipelineStage[] = [
	{
		id: "design",
		label: "도안 배경 정리",
		state: "wait",
		detail: "",
		progress: 0,
	},
	{
		id: "mask",
		label: "신체 영역 분리",
		state: "wait",
		detail: "",
		progress: 0,
	},
	{
		id: "depth",
		label: "3D 굴곡 분석",
		state: "wait",
		detail: "",
		progress: 0,
	},
];

/** 다른 출처의 이미지는 blob으로 변환해 캔버스 CORS 오염을 막는다. */
function isCrossOrigin(url: string): boolean {
	if (!/^https?:/i.test(url)) return false;
	try {
		return new URL(url, window.location.href).origin !== window.location.origin;
	} catch {
		return false;
	}
}

async function loadImage(url: string): Promise<HTMLImageElement> {
	let objectUrl: string | null = null;
	if (isCrossOrigin(url)) {
		const response = await fetch(url, { mode: "cors" });
		if (!response.ok) throw new Error("이미지를 불러오지 못했습니다.");
		objectUrl = URL.createObjectURL(await response.blob());
	}

	const source = objectUrl ?? url;
	try {
		return await new Promise<HTMLImageElement>((resolve, reject) => {
			const image = new Image();
			image.onload = () => resolve(image);
			image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
			image.src = source;
		});
	} finally {
		if (objectUrl) URL.revokeObjectURL(objectUrl);
	}
}

/** 변경: 사진 중앙이 배경인 경우 가장 가까운 신체 좌표를 초기 배치점으로 쓴다. */
function findInitialAnchor(mask: PersonMask) {
	if (isPointInsidePerson(mask, INITIAL_TRANSFORM.x, INITIAL_TRANSFORM.y)) {
		return INITIAL_CLIP_ANCHOR;
	}

	let closest = INITIAL_CLIP_ANCHOR;
	let closestDistance = Number.POSITIVE_INFINITY;
	for (let y = 0; y < mask.height; y += 1) {
		for (let x = 0; x < mask.width; x += 1) {
			if (mask.data[y * mask.width + x] < 0.35) continue;
			const normalizedX = x / Math.max(1, mask.width - 1);
			const normalizedY = y / Math.max(1, mask.height - 1);
			const candidateDistance =
				(normalizedX - INITIAL_TRANSFORM.x) ** 2 +
				(normalizedY - INITIAL_TRANSFORM.y) ** 2;
			if (candidateDistance < closestDistance) {
				closestDistance = candidateDistance;
				closest = { x: normalizedX, y: normalizedY };
			}
		}
	}
	return closest;
}

/**
 * 변경: 기존 이미지(3D) STEP 3 UI 안에서 두 번째 PoC의
 * MediaPipe 인물 마스크, Depth Anything V2, WebGL2 합성 엔진을 실행한다.
 */
export default function Simulation3DStep({
	designUrl,
	photoUrl,
}: Simulation3DStepProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const requestRef = useRef(0);
	const pointerRef = useRef<PointerSession>(EMPTY_POINTER_SESSION);

	const [bodyImage, setBodyImage] = useState<HTMLImageElement | null>(null);
	const [tattooImage, setTattooImage] = useState<HTMLCanvasElement | null>(null);
	const [personMask, setPersonMask] = useState<PersonMask | null>(null);
	const [depth, setDepth] = useState<DepthMap | null>(null);
	const [stages, setStages] = useState<PipelineStage[]>(INITIAL_STAGES);
	const [transform, setTransform] =
		useState<TattooTransform>(INITIAL_TRANSFORM);
	const [clipAnchor, setClipAnchor] = useState(INITIAL_CLIP_ANCHOR);
	const [curvature, setCurvature] = useState(0.82);
	const [opacity, setOpacity] = useState(0.78);
	const [error, setError] = useState<string | null>(null);

	const depthPreview = useMemo(
		() => (depth ? createDepthPreview(depth) : null),
		[depth],
	);
	const ready = Boolean(bodyImage && tattooImage && personMask && depth);

	// 변경: STEP 3에 들어오면 별도 실행 버튼 없이 분석 파이프라인을 시작한다.
	useEffect(() => {
		if (!designUrl || !photoUrl) return undefined;

		const requestId = ++requestRef.current;
		let cancelled = false;
		setBodyImage(null);
		setTattooImage(null);
		setPersonMask(null);
		setDepth(null);
		setTransform(INITIAL_TRANSFORM);
		setClipAnchor(INITIAL_CLIP_ANCHOR);
		setStages(INITIAL_STAGES);
		setError(null);

		const setStage = (
			id: PipelineStage["id"],
			state: StageState,
			detail = "",
			progress = state === "done" ? 100 : 0,
		) => {
			if (cancelled || requestRef.current !== requestId) return;
			setStages((current) =>
				current.map((stage) =>
					stage.id === id
						? {
								...stage,
								state,
								detail,
								progress: Math.min(100, Math.max(0, progress)),
							}
						: stage,
				),
			);
		};

		const runPipeline = async () => {
			try {
				setStage("design", "busy", "이미지를 불러오는 중", 12);
				const [photo, design] = await Promise.all([
					loadImage(photoUrl),
					loadImage(designUrl),
				]);
				if (cancelled || requestRef.current !== requestId) return;

				const cleanedTattoo = removeTattooBackground(design);
				setBodyImage(photo);
				setTattooImage(cleanedTattoo);
				setStage("design", "done", "도안 준비 완료", 100);

				setStage("mask", "busy", "인물 분할 모델을 준비하는 중", 5);
				const mask = await segmentPerson(photo, (label, progress) =>
					setStage("mask", "busy", label, progress ?? 5),
				);
				if (cancelled || requestRef.current !== requestId) return;

				const initialAnchor = findInitialAnchor(mask);
				setPersonMask(mask);
				setTransform((current) => ({
					...current,
					x: initialAnchor.x,
					y: initialAnchor.y,
				}));
				setClipAnchor(initialAnchor);
				setStage("mask", "done", "신체 영역 분리 완료", 100);

				setStage("depth", "busy", "3D 굴곡 모델을 준비하는 중", 3);
				const depthResult = await estimateDepth(
					photo,
					mask,
					(label, progress) =>
						setStage("depth", "busy", label, progress ?? 3),
				);
				if (cancelled || requestRef.current !== requestId) return;

				setDepth(depthResult);
				setStage(
					"depth",
					"done",
					depthResult.engine === "depth-anything-v2"
						? "3D 굴곡 분석 완료"
						: "로컬 굴곡 분석 완료",
					100,
				);
			} catch (pipelineError) {
				if (cancelled || requestRef.current !== requestId) return;
				const message =
					pipelineError instanceof Error
						? pipelineError.message
						: "시뮬레이션 처리 중 오류가 발생했습니다.";
				setError(message);
				setStages((current) =>
					current.map((stage) =>
						stage.state === "busy"
							? { ...stage, state: "error", detail: message }
							: stage,
					),
				);
			}
		};

		void runPipeline();
		return () => {
			cancelled = true;
			requestRef.current += 1;
		};
	}, [designUrl, photoUrl]);

	// 변경: 상태가 바뀔 때마다 새 WebGL2/Canvas 엔진으로 현재 장면을 다시 합성한다.
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !bodyImage) return;

		const scale = Math.min(
			1,
			1600 / Math.max(bodyImage.width, bodyImage.height),
		);
		const width = Math.max(1, Math.round(bodyImage.width * scale));
		const height = Math.max(1, Math.round(bodyImage.height * scale));
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
		}

		renderScene({
			canvas,
			body: bodyImage,
			tattoo: tattooImage,
			depth,
			depthPreview,
			personMask,
			transform,
			clipAnchor,
			settings: { curvature, opacity },
			showDepth: false,
			showPersonMask: false,
			showGuides: ready,
		});
	}, [
		bodyImage,
		tattooImage,
		depth,
		depthPreview,
		personMask,
		transform,
		clipAnchor,
		curvature,
		opacity,
		ready,
	]);

	const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		const canvas = event.currentTarget;
		const bounds = canvas.getBoundingClientRect();
		const displayScale = Math.min(
			bounds.width / Math.max(1, canvas.width),
			bounds.height / Math.max(1, canvas.height),
		);
		const displayWidth = canvas.width * displayScale;
		const displayHeight = canvas.height * displayScale;
		const displayLeft = bounds.left + (bounds.width - displayWidth) / 2;
		const displayTop = bounds.top + (bounds.height - displayHeight) / 2;
		return {
			x: Math.min(
				canvas.width,
				Math.max(
					0,
					((event.clientX - displayLeft) / displayWidth) * canvas.width,
				),
			),
			y: Math.min(
				canvas.height,
				Math.max(
					0,
					((event.clientY - displayTop) / displayHeight) * canvas.height,
				),
			),
		};
	};

	const handlePointerDown = (
		event: ReactPointerEvent<HTMLCanvasElement>,
	) => {
		const canvas = canvasRef.current;
		if (!canvas || !tattooImage || !personMask || !depth) return;

		const point = pointFromEvent(event);
		const geometry = getOverlayGeometry(
			canvas.width,
			canvas.height,
			tattooImage,
			transform,
		);
		const handleRadius = Math.max(18, canvas.width * 0.018);
		const scaleHandle = geometry.corners.find(
			(corner) => distance(point, corner) <= handleRadius,
		);
		let mode: InteractionMode = "idle";
		let sessionTransform = transform;

		if (distance(point, geometry.rotationHandle) <= handleRadius * 1.2) {
			mode = "rotate";
		} else if (scaleHandle) {
			mode = "scale";
		} else {
			const normalizedPoint = {
				x: point.x / canvas.width,
				y: point.y / canvas.height,
			};
			// 변경: 배경 클릭은 무시하고 신체 클릭만 도안 이동을 시작한다.
			if (
				!isPointInsidePerson(
					personMask,
					normalizedPoint.x,
					normalizedPoint.y,
				)
			) {
				return;
			}

			mode = "drag";
			sessionTransform = {
				...transform,
				x: normalizedPoint.x,
				y: normalizedPoint.y,
			};
			// 변경: 드래그 중에도 절단 기준은 최초 클릭한 신체 좌표로 고정한다.
			setClipAnchor(normalizedPoint);
			setTransform(sessionTransform);
		}

		event.currentTarget.focus();
		event.currentTarget.setPointerCapture(event.pointerId);
		const center = {
			x: sessionTransform.x * canvas.width,
			y: sessionTransform.y * canvas.height,
		};
		pointerRef.current = {
			mode,
			startPoint: point,
			startTransform: sessionTransform,
			lastTransform: sessionTransform,
			startDistance: distance(point, center),
			startAngle: Math.atan2(point.y - center.y, point.x - center.x),
		};
	};

	const handlePointerMove = (
		event: ReactPointerEvent<HTMLCanvasElement>,
	) => {
		const canvas = canvasRef.current;
		const session = pointerRef.current;
		if (
			!canvas ||
			!tattooImage ||
			!personMask ||
			session.mode === "idle"
		) {
			return;
		}

		const point = pointFromEvent(event);
		const start = session.startTransform;
		const center = {
			x: start.x * canvas.width,
			y: start.y * canvas.height,
		};

		if (session.mode === "drag") {
			const nextTransform = {
				...start,
				x: Math.min(
					1,
					Math.max(
						0,
						start.x + (point.x - session.startPoint.x) / canvas.width,
					),
				),
				y: Math.min(
					1,
					Math.max(
						0,
						start.y + (point.y - session.startPoint.y) / canvas.height,
					),
				),
			};
			const previousCenter = {
				x: session.lastTransform.x,
				y: session.lastTransform.y,
			};
			const nextCenter = {
				x: nextTransform.x,
				y: nextTransform.y,
			};
			if (
				!isPointInsidePerson(personMask, nextCenter.x, nextCenter.y) ||
				!isPersonPathContinuous(personMask, previousCenter, nextCenter)
			) {
				return;
			}
			session.lastTransform = nextTransform;
			setTransform(nextTransform);
		} else if (session.mode === "scale") {
			const nextDistance = distance(point, center);
			const ratio = nextDistance / Math.max(1, session.startDistance);
			setTransform({
				...start,
				width: Math.min(1.2, Math.max(0.045, start.width * ratio)),
			});
		} else if (session.mode === "rotate") {
			const nextAngle = Math.atan2(point.y - center.y, point.x - center.x);
			setTransform({
				...start,
				rotation: start.rotation + nextAngle - session.startAngle,
			});
		}
	};

	const endPointerSession = () => {
		pointerRef.current = EMPTY_POINTER_SESSION;
	};

	const handleCanvasKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
		if (!personMask || !depth) return;
		const move = event.shiftKey ? 0.01 : 0.003;
		const next = { ...transform };
		if (event.key === "ArrowLeft") next.x = Math.max(0, transform.x - move);
		else if (event.key === "ArrowRight")
			next.x = Math.min(1, transform.x + move);
		else if (event.key === "ArrowUp") next.y = Math.max(0, transform.y - move);
		else if (event.key === "ArrowDown")
			next.y = Math.min(1, transform.y + move);
		else if (event.key === "[") next.rotation -= Math.PI / 90;
		else if (event.key === "]") next.rotation += Math.PI / 90;
		else return;

		const centerChanged = next.x !== transform.x || next.y !== transform.y;
		if (
			centerChanged &&
			(!isPointInsidePerson(personMask, next.x, next.y) ||
				!isPersonPathContinuous(
					personMask,
					{ x: transform.x, y: transform.y },
					{ x: next.x, y: next.y },
				))
		) {
			return;
		}
		event.preventDefault();
		setTransform(next);
	};

	const resetPlacement = () => {
		const initialAnchor = personMask
			? findInitialAnchor(personMask)
			: INITIAL_CLIP_ANCHOR;
		setTransform({
			...INITIAL_TRANSFORM,
			x: initialAnchor.x,
			y: initialAnchor.y,
		});
		setClipAnchor(initialAnchor);
		setCurvature(0.82);
		setOpacity(0.78);
	};

	const downloadResult = () => {
		if (!bodyImage || !tattooImage || !personMask || !depth) return;

		const scale = Math.min(
			1,
			2400 / Math.max(bodyImage.width, bodyImage.height),
		);
		const exportCanvas = document.createElement("canvas");
		exportCanvas.width = Math.max(1, Math.round(bodyImage.width * scale));
		exportCanvas.height = Math.max(1, Math.round(bodyImage.height * scale));
		renderScene({
			canvas: exportCanvas,
			body: bodyImage,
			tattoo: tattooImage,
			depth,
			depthPreview,
			personMask,
			transform,
			clipAnchor,
			settings: { curvature, opacity },
			showDepth: false,
			showPersonMask: false,
			showGuides: false,
		});

		exportCanvas.toBlob((blob) => {
			if (!blob) return;
			const link = document.createElement("a");
			const objectUrl = URL.createObjectURL(blob);
			link.href = objectUrl;
			link.download = "starttoo-simulation.png";
			document.body.appendChild(link);
			link.click();
			link.remove();
			window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
		}, "image/png");
	};

	if (!designUrl || !photoUrl) {
		return (
			<p className="text-center text-[14px] font-light text-black/50">
				이전 단계에서 도안과 신체 사진을 먼저 올려주세요
			</p>
		);
	}

	return (
		<div className="flex size-full min-h-0 flex-col items-center gap-3">
			<div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-[12px] bg-black/[0.03]">
				<canvas
					ref={canvasRef}
					tabIndex={0}
					aria-label="타투 위치, 크기, 회전을 편집하는 캔버스"
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={endPointerSession}
					onPointerCancel={endPointerSession}
					onKeyDown={handleCanvasKeyDown}
					className={`max-h-full max-w-full touch-none rounded-[12px] shadow-md outline-none ${
						bodyImage ? "block cursor-grab" : "hidden"
					}`}
				/>

				{!bodyImage && !error && (
					<div className="h-[260px] w-[220px] animate-pulse rounded-[12px] bg-black/10" />
				)}

				{!ready && !error && (
					<div className="absolute inset-0 flex items-center justify-center rounded-[12px] bg-black/55">
						<div className="w-[290px] rounded-xl bg-white px-5 py-4 shadow-lg">
							<p className="mb-2 text-[12px] font-semibold text-black/55">
								시뮬레이션을 준비하고 있어요
							</p>
							{stages.map((stage) => (
								<div key={stage.id} className="py-1.5">
									<div className="flex items-center gap-2">
										{stage.state === "done" && (
											<span className="text-[13px] text-green-600">✓</span>
										)}
										{stage.state === "busy" && (
											<span className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
										)}
										{stage.state === "error" && (
											<span className="text-[13px] text-brand">!</span>
										)}
										{stage.state === "wait" && (
											<span className="size-3 rounded-full border-2 border-black/15" />
										)}
										<span
											className={`text-[13px] ${
												stage.state === "wait"
													? "font-light text-black/40"
													: "font-semibold text-black"
											}`}>
											{stage.label}
										</span>
										{stage.state === "busy" && (
											<span className="ml-auto font-mono text-[10px] text-brand">
												{Math.round(stage.progress)}%
											</span>
										)}
									</div>
									{stage.detail && (
										<p className="ml-5 mt-0.5 truncate text-[10px] font-light text-black/45">
											{stage.detail}
										</p>
									)}
								</div>
							))}
						</div>
					</div>
				)}

				{error && (
					<div className="absolute inset-0 flex items-center justify-center rounded-[12px] bg-white/90 px-6">
						<p className="text-center text-[13px] leading-5 text-brand">
							{error}
							<br />
							이전 단계에서 이미지를 다시 선택해주세요.
						</p>
					</div>
				)}

				{ready && (
					<span className="pointer-events-none absolute bottom-2 right-2 whitespace-nowrap rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-light text-white/90">
						신체 클릭·드래그 이동 · 모서리 크기 · 상단 핸들 회전
					</span>
				)}
			</div>

			{ready && (
				<div className="w-full max-w-[620px] shrink-0 rounded-[12px] bg-white px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
					<div className="grid gap-3 sm:grid-cols-2">
						<label className="block">
							<span className="flex items-center justify-between text-[12px] text-black/65">
								굴곡 반영
								<b className="font-mono text-[11px] text-brand">
									{curvature.toFixed(2)}
								</b>
							</span>
							<input
								type="range"
								min={0}
								max={1.5}
								step={0.01}
								value={curvature}
								onChange={(event) =>
									setCurvature(Number(event.target.value))
								}
								className="mt-1 w-full accent-brand"
							/>
						</label>
						<label className="block">
							<span className="flex items-center justify-between text-[12px] text-black/65">
								잉크 농도
								<b className="font-mono text-[11px] text-brand">
									{Math.round(opacity * 100)}%
								</b>
							</span>
							<input
								type="range"
								min={0.25}
								max={1}
								step={0.01}
								value={opacity}
								onChange={(event) => setOpacity(Number(event.target.value))}
								className="mt-1 w-full accent-brand"
							/>
						</label>
					</div>
					<div className="mt-2 flex justify-center gap-2">
						<button
							type="button"
							onClick={resetPlacement}
							className="inline-flex h-[36px] min-w-[110px] items-center justify-center rounded-[50px] border border-black/10 bg-white text-[12px] font-semibold text-black/55 transition hover:border-black/25">
							배치 초기화
						</button>
						<button
							type="button"
							onClick={downloadResult}
							className="inline-flex h-[36px] min-w-[150px] items-center justify-center rounded-[50px] bg-brand text-[12px] font-semibold text-white transition hover:brightness-95">
							결과 이미지 저장
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
