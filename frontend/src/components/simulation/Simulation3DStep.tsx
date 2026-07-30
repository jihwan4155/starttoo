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
	isPersonPathContinuous,
	isPointInsidePerson,
	removeTattooBackground,
	renderScene,
	type PersonMask,
	type TattooTransform,
} from "./inkproof/image-engine";
import { loadImage, type BodyScanResult } from "./useBodyScan";

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
	scan: BodyScanResult;
};

// 고정값: 굴곡 반영 1.1, 잉크 농도 70% (사용자 조절 UI 제거)
const FIXED_CURVATURE = 1.1;
const FIXED_OPACITY = 0.7;

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

/** 사진 중앙이 배경인 경우 가장 가까운 신체 좌표를 초기 배치점으로 쓴다. */
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
 * 신체 사진 스캔(마스크·굴곡)은 앞 단계에서 백그라운드로 끝나 있고,
 * 이 단계에서는 도안 배경만 정리해 3D 합성·배치·저장을 담당한다.
 */
export default function Simulation3DStep({
	designUrl,
	scan,
}: Simulation3DStepProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const pointerRef = useRef<PointerSession>(EMPTY_POINTER_SESSION);
	const anchorInitializedRef = useRef(false);

	const { bodyImage, personMask, depth } = scan;

	const [tattooImage, setTattooImage] = useState<HTMLCanvasElement | null>(
		null,
	);
	const [designError, setDesignError] = useState<string | null>(null);
	const [transform, setTransform] = useState<TattooTransform>(INITIAL_TRANSFORM);
	const [clipAnchor, setClipAnchor] = useState(INITIAL_CLIP_ANCHOR);

	const depthPreview = useMemo(
		() => (depth ? createDepthPreview(depth) : null),
		[depth],
	);
	const ready = Boolean(bodyImage && tattooImage && personMask && depth);

	// 도안 배경만 이 단계에서 정리한다. (마스크·굴곡은 이미 준비됨)
	useEffect(() => {
		if (!designUrl) {
			setTattooImage(null);
			return undefined;
		}
		let cancelled = false;
		setTattooImage(null);
		setDesignError(null);
		loadImage(designUrl)
			.then((image) => {
				if (cancelled) return;
				setTattooImage(removeTattooBackground(image));
			})
			.catch((loadError) => {
				if (cancelled) return;
				setDesignError(
					loadError instanceof Error
						? loadError.message
						: "도안을 불러오지 못했습니다.",
				);
			});
		return () => {
			cancelled = true;
		};
	}, [designUrl]);

	// 마스크가 준비되면 초기 배치점을 신체 위로 한 번만 맞춘다.
	useEffect(() => {
		if (!personMask) {
			anchorInitializedRef.current = false;
			return;
		}
		if (anchorInitializedRef.current) return;
		anchorInitializedRef.current = true;
		const initialAnchor = findInitialAnchor(personMask);
		setTransform((current) => ({
			...current,
			x: initialAnchor.x,
			y: initialAnchor.y,
		}));
		setClipAnchor(initialAnchor);
	}, [personMask]);

	// 상태가 바뀔 때마다 WebGL2/Canvas 엔진으로 현재 장면을 다시 합성한다.
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
			settings: { curvature: FIXED_CURVATURE, opacity: FIXED_OPACITY },
			showDepth: false,
			showPersonMask: false,
			showGuides: false,
		});
	}, [
		bodyImage,
		tattooImage,
		depth,
		depthPreview,
		personMask,
		transform,
		clipAnchor,
	]);

	// 휠로 확대·축소, Shift+휠로 회전한다. 페이지 스크롤을 막으려면
	// passive:false 네이티브 리스너가 필요하다.
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return undefined;

		const handleWheel = (event: WheelEvent) => {
			if (!ready) return;
			event.preventDefault();
			if (event.shiftKey) {
				const rotationStep = (event.deltaY < 0 ? -1 : 1) * (Math.PI / 60);
				setTransform((current) => ({
					...current,
					rotation: current.rotation + rotationStep,
				}));
			} else {
				const scaleFactor = event.deltaY < 0 ? 1.05 : 1 / 1.05;
				setTransform((current) => ({
					...current,
					width: Math.min(1.2, Math.max(0.045, current.width * scaleFactor)),
				}));
			}
		};

		canvas.addEventListener("wheel", handleWheel, { passive: false });
		return () => canvas.removeEventListener("wheel", handleWheel);
	}, [ready]);

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

	const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		if (!canvas || !tattooImage || !personMask || !depth) return;

		const point = pointFromEvent(event);
		const normalizedPoint = {
			x: point.x / canvas.width,
			y: point.y / canvas.height,
		};
		// 배경 클릭은 무시하고 신체 클릭만 도안 이동을 시작한다.
		if (!isPointInsidePerson(personMask, normalizedPoint.x, normalizedPoint.y)) {
			return;
		}

		// 확대·회전은 휠로 처리하고 포인터는 이동만 담당한다.
		const mode: InteractionMode = "drag";
		const sessionTransform = {
			...transform,
			x: normalizedPoint.x,
			y: normalizedPoint.y,
		};
		// 드래그 중에도 절단 기준은 최초 클릭한 신체 좌표로 고정한다.
		setClipAnchor(normalizedPoint);
		setTransform(sessionTransform);

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

	const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		const session = pointerRef.current;
		if (!canvas || !tattooImage || !personMask || session.mode === "idle") {
			return;
		}

		const point = pointFromEvent(event);
		const start = session.startTransform;

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
			settings: { curvature: FIXED_CURVATURE, opacity: FIXED_OPACITY },
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

	if (!designUrl) {
		return (
			<p className="text-center text-[14px] font-light text-black/50">
				이전 단계에서 타투 도안을 먼저 선택해주세요
			</p>
		);
	}

	const errorMessage = designError ?? scan.error;
	// 스캔 진행률 + 도안 준비 상태를 합쳐 준비 화면에 표시한다.
	const preparingLabel =
		scan.status !== "ready"
			? scan.label || "신체 사진을 분석하는 중"
			: "도안을 준비하는 중";
	const preparingProgress =
		scan.status !== "ready" ? scan.progress : tattooImage ? 100 : 92;

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

				{!bodyImage && !errorMessage && (
					<div className="h-[260px] w-[220px] animate-pulse rounded-[12px] bg-black/10" />
				)}

				{!ready && !errorMessage && (
					<div className="absolute inset-0 flex items-center justify-center rounded-[12px] bg-black/55">
						<div className="w-[290px] rounded-xl bg-white px-5 py-4 shadow-lg">
							<p className="mb-3 text-[12px] font-semibold text-black/55">
								시뮬레이션을 준비하고 있어요
							</p>
							<div className="flex items-center gap-2">
								<span className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
								<span className="text-[13px] font-semibold text-black">
									{preparingLabel}
								</span>
								<span className="ml-auto font-mono text-[10px] text-brand">
									{Math.round(preparingProgress)}%
								</span>
							</div>
							<div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/10">
								<div
									className="h-full rounded-full bg-brand transition-[width]"
									style={{ width: `${Math.round(preparingProgress)}%` }}
								/>
							</div>
						</div>
					</div>
				)}

				{errorMessage && (
					<div className="absolute inset-0 flex items-center justify-center rounded-[12px] bg-white/90 px-6">
						<p className="text-center text-[13px] leading-5 text-brand">
							{errorMessage}
							<br />
							이전 단계에서 이미지를 다시 선택해주세요.
						</p>
					</div>
				)}

				{ready && (
					<span className="pointer-events-none absolute bottom-2 right-2 whitespace-nowrap rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-light text-white/90">
						신체 클릭·드래그 이동 · 휠 확대·축소 · Shift+휠 회전
					</span>
				)}
			</div>

			{ready && (
				<div className="flex w-full max-w-[620px] shrink-0 justify-center">
					<button
						type="button"
						onClick={downloadResult}
						className="inline-flex h-[36px] min-w-[150px] items-center justify-center rounded-[50px] bg-brand text-[12px] font-semibold text-white transition hover:brightness-95">
						결과 이미지 저장
					</button>
				</div>
			)}
		</div>
	);
}
