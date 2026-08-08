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
import StarttooLoader from "../loader/StarttooLoader";

type InteractionMode = "idle" | "drag" | "gesture";

type PointerSession = {
	mode: InteractionMode;
	startPoint: { x: number; y: number };
	startTransform: TattooTransform;
	lastTransform: TattooTransform;
	startDistance: number;
	startAngle: number;
	/**
	 * 이 세션이 시작되기 직전 상태.
	 *
	 * <p>첫 손가락은 닿는 즉시 도안을 그 자리로 옮긴다. 두 손가락을 거의 동시에
	 * 올리는 핀치에서도 먼저 닿은 쪽이 그 이동을 일으키므로, 아직 끌지 않은
	 * 상태에서 두 번째 손가락이 오면 여기 담아 둔 값으로 되돌린 뒤 제스처로 넘어간다.
	 */
	restore: { transform: TattooTransform; clipAnchor: { x: number; y: number } } | null;
	/** 이 세션에서 실제로 끌었는지 (손가락이 닿기만 한 것과 구분) */
	moved: boolean;
};

type Simulation3DStepProps = {
	designUrl: string | null;
	scan: BodyScanResult;
	onSaved?: () => void;
};

// 고정값: 굴곡 반영 1.1 (잉크 농도는 사용자가 직접 조절)
const FIXED_CURVATURE = 1.1;
const DEFAULT_OPACITY = 0.7;

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
	restore: null,
	moved: false,
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
	onSaved,
}: Simulation3DStepProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const pointerRef = useRef<PointerSession>(EMPTY_POINTER_SESSION);
	const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
	const anchorInitializedRef = useRef(false);

	const { bodyImage, personMask, depth } = scan;

	const [tattooImage, setTattooImage] = useState<HTMLCanvasElement | null>(
		null,
	);
	const [designError, setDesignError] = useState<string | null>(null);
	const [transform, setTransform] = useState<TattooTransform>(INITIAL_TRANSFORM);
	const [clipAnchor, setClipAnchor] = useState(INITIAL_CLIP_ANCHOR);
	const [opacity, setOpacity] = useState(DEFAULT_OPACITY);

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
			settings: { curvature: FIXED_CURVATURE, opacity },
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
		opacity,
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
		activePointersRef.current.set(event.pointerId, point);
		event.currentTarget.setPointerCapture(event.pointerId);
		if (activePointersRef.current.size > 2) return;

		if (activePointersRef.current.size === 2) {
			const previous = pointerRef.current;
			// 첫 손가락이 닿자마자 옮겨 놓은 도안은 제자리로 돌린다. 두 손가락이
			// 올라온 이상 옮기려던 것이 아니라 확대·회전하려던 손이다.
			const restore =
				previous.mode === "drag" && !previous.moved ? previous.restore : null;
			if (restore) {
				setTransform(restore.transform);
				setClipAnchor(restore.clipAnchor);
			}
			const baseTransform = restore ? restore.transform : transform;
			const [first, second] = Array.from(activePointersRef.current.values());
			const midpoint = {
				x: (first.x + second.x) / 2,
				y: (first.y + second.y) / 2,
			};
			pointerRef.current = {
				mode: "gesture",
				startPoint: midpoint,
				startTransform: baseTransform,
				lastTransform: baseTransform,
				startDistance: Math.max(1, distance(first, second)),
				startAngle: Math.atan2(second.y - first.y, second.x - first.x),
				restore: null,
				moved: false,
			};
			return;
		}
		const normalizedPoint = {
			x: point.x / canvas.width,
			y: point.y / canvas.height,
		};
		/*
		 * 배경 클릭은 도안 이동을 시작하지 않는다. 다만 손가락은 등록해 둔 채로
		 * 둔다 — 여기서 지워 버리면 배경을 짚은 손가락이 없는 셈이 되어, 두 손가락
		 * 핀치가 늘 "한 손가락 두 번"으로 인식돼 확대·회전이 아예 걸리지 않는다.
		 */
		if (!isPointInsidePerson(personMask, normalizedPoint.x, normalizedPoint.y)) {
			pointerRef.current = EMPTY_POINTER_SESSION;
			return;
		}

		// 확대·회전은 휠·두 손가락으로 처리하고 한 포인터는 이동만 담당한다.
		const mode: InteractionMode = "drag";
		const sessionTransform = {
			...transform,
			x: normalizedPoint.x,
			y: normalizedPoint.y,
		};
		const previousState = { transform, clipAnchor };
		// 드래그 중에도 절단 기준은 최초 클릭한 신체 좌표로 고정한다.
		setClipAnchor(normalizedPoint);
		setTransform(sessionTransform);

		event.currentTarget.focus();
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
			restore: previousState,
			moved: false,
		};
	};

	const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		const session = pointerRef.current;
		if (!canvas || !tattooImage || !personMask || session.mode === "idle") {
			return;
		}

		const point = pointFromEvent(event);
		if (activePointersRef.current.has(event.pointerId)) {
			activePointersRef.current.set(event.pointerId, point);
		}
		const start = session.startTransform;

		if (session.mode === "gesture" && activePointersRef.current.size >= 2) {
			const [first, second] = Array.from(activePointersRef.current.values());
			const midpoint = {
				x: (first.x + second.x) / 2,
				y: (first.y + second.y) / 2,
			};
			const nextDistance = Math.max(1, distance(first, second));
			const nextAngle = Math.atan2(second.y - first.y, second.x - first.x);
			const angleDelta = Math.atan2(
				Math.sin(nextAngle - session.startAngle),
				Math.cos(nextAngle - session.startAngle),
			);
			// 크기·회전은 손가락 사이 거리·각도만 보므로 항상 반영한다. 이동만
			// 신체 위에 머무는지 따져, 두 손가락 중간점이 배경으로 나가더라도
			// 확대·회전이 멈추지 않게 한다.
			const resized = {
				...start,
				width: Math.min(1.2, Math.max(0.045, start.width * (nextDistance / session.startDistance))),
				rotation: start.rotation + angleDelta,
			};
			const moved = {
				...resized,
				x: Math.min(1, Math.max(0, start.x + (midpoint.x - session.startPoint.x) / canvas.width)),
				y: Math.min(1, Math.max(0, start.y + (midpoint.y - session.startPoint.y) / canvas.height)),
			};
			const canMove =
				isPointInsidePerson(personMask, moved.x, moved.y) &&
				isPersonPathContinuous(
					personMask,
					{ x: session.lastTransform.x, y: session.lastTransform.y },
					{ x: moved.x, y: moved.y },
				);
			const nextTransform = canMove
				? moved
				: {
						...resized,
						x: session.lastTransform.x,
						y: session.lastTransform.y,
					};
			session.moved = true;
			session.lastTransform = nextTransform;
			setClipAnchor({ x: nextTransform.x, y: nextTransform.y });
			setTransform(nextTransform);
			return;
		}

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
			session.moved = true;
			session.lastTransform = nextTransform;
			setTransform(nextTransform);
		}
	};

	const endPointerSession = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		activePointersRef.current.delete(event.pointerId);
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
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
			settings: { curvature: FIXED_CURVATURE, opacity },
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
			onSaved?.();
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

	return (
		<div className="flex size-full min-h-0 flex-col items-center gap-3">
			<div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-[12px] bg-black/[0.03]">
				{/*
				  캔버스 크기는 h-full + w-auto로 준다. 캔버스는 고유 비율(원본 사진
				  비율)을 가진 대체 요소라 높이만 정해 주면 너비가 따라오고, 작은 사진을
				  올려도 박스 높이를 꽉 채운다. max-*만 걸면 원본 픽셀 크기보다 커지지
				  못해 큰 박스 한가운데 우표만 한 사진이 남는다. 가로가 긴 사진은
				  max-w-full이 먼저 걸려 너비 쪽이 박스 끝에 닿는데, 이때 높이는 깎이지
				  않아 그림이 눌린다 — object-contain이 그 경우 비율을 지켜 준다.
				  (pointFromEvent가 같은 contain 규칙으로 좌표를 되돌린다)
				*/}
				<canvas
					ref={canvasRef}
					tabIndex={0}
					aria-label="타투 위치, 크기, 회전을 편집하는 캔버스"
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={endPointerSession}
					onPointerCancel={endPointerSession}
					onKeyDown={handleCanvasKeyDown}
					className={`h-full w-auto max-h-full max-w-full object-contain touch-none rounded-[12px] shadow-md outline-none ${
						bodyImage ? "block cursor-grab" : "hidden"
					}`}
				/>

				{!bodyImage && !errorMessage && (
					<div className="h-[260px] w-[220px] animate-pulse rounded-[12px] bg-black/10" />
				)}

				{!ready && !errorMessage && (
					<div className="absolute inset-0 flex items-center justify-center rounded-[12px] bg-[#f0f0ec]/55 backdrop-blur-[3px]">
						<StarttooLoader variant="block" size={180} label={null} />
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
						<span className="lg:hidden">한 손가락 이동 · 두 손가락 크기/회전</span>
						<span className="hidden lg:inline">드래그 이동 · 휠 크기 · Shift+휠 회전</span>
					</span>
				)}
			</div>

			{ready && (
				<div className="flex w-full max-w-[620px] shrink-0 flex-col gap-2.5 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:max-w-none max-lg:bg-white/95 max-lg:px-4 max-lg:pt-3 max-lg:pb-[max(12px,env(safe-area-inset-bottom))] max-lg:backdrop-blur-sm">
					<div className="flex items-center justify-center gap-3 px-1">
						<span className="whitespace-nowrap text-[11px] font-light text-black/50">
							타투농도
						</span>
						<input
							type="range"
							min={0.2}
							max={1}
							step={0.01}
							value={opacity}
							onChange={(event) => setOpacity(Number(event.target.value))}
							aria-label="타투 잉크 농도"
							className="h-1.5 w-32 cursor-pointer appearance-none rounded-full accent-brand"
							style={{
								background: `linear-gradient(to right, var(--color-brand) ${((opacity - 0.2) / 0.8) * 100}%, rgba(0,0,0,0.1) ${((opacity - 0.2) / 0.8) * 100}%)`,
							}}
						/>
						<span className="w-9 text-right text-[11px] font-light text-black/50 tabular-nums">
							{Math.round(opacity * 100)}%
						</span>
					</div>
					<button
						type="button"
						onClick={downloadResult}
						className="inline-flex h-[36px] min-w-[150px] items-center justify-center self-center rounded-[50px] bg-brand text-[12px] font-semibold text-white transition hover:brightness-95 max-lg:h-[60px] max-lg:w-full max-lg:rounded-b-none max-lg:rounded-t-[10px] max-lg:text-[20px] max-lg:font-bold">
						기기에 저장
					</button>
				</div>
			)}
		</div>
	);
}
