import { useEffect, useState, type CSSProperties } from "react";
import "./StarttooLoader.css";
import {
	DOT_RADIUS,
	MARK_STAR,
	MARK_VIEW_BOX,
	ORBITS,
	STARS,
	VIEW_BOX,
	WORDMARK,
} from "./loaderArt";

/* ─────────────────────────────────────────────
   starttoo 브랜드 로더 — 로고의 점선 궤도 2개 위를 점 3개가 돕니다.
   워드마크는 고정이고, 궤도 위의 별 3개는 점이 지날 때 반짝입니다.

   외부 의존성 없음 (React만 필요). 웹폰트·GIF·Lottie도 쓰지 않습니다 —
   워드마크·궤도·별은 전부 원본 로고에서 실측한 SVG 경로(loaderArt.ts)입니다.

   · page  : 화면 전체 오버레이. 최초 부팅·라우트 전환. 뒤쪽 클릭을 막습니다.
   · block : 카드·섹션·목록 자리를 채우는 인라인 블록.
   · mark  : 버튼·인풋 안 16~32px. 이 크기에서는 궤도가 판독되지 않아
             로고의 별 하나만 회전합니다.
   ───────────────────────────────────────────── */

export type StarttooLoaderVariant = "page" | "block" | "mark";

export type StarttooLoaderProps = {
	variant?: StarttooLoaderVariant;
	/** false가 되면 페이드아웃 */
	visible?: boolean;
	/** 진행 문구. null이면 문구 줄을 아예 감춥니다 (mark는 항상 스크린리더 전용) */
	label?: string | null;
	/** 0~100. 주면 determinate — 궤도가 채워지고 점이 그 끝에 섭니다 */
	progress?: number;
	/** 아트워크 가로 크기(px). 생략하면 변형별 기본값 */
	size?: number;
	/** 점이 궤도를 한 바퀴 도는 시간(ms) */
	durationMs?: number;
	/** 이 시간(ms)이 지나면 안심 문구를 띄웁니다 */
	slowAfterMs?: number;
	/**
	 * 이 시간(ms) 안에 끝나면 로더를 아예 띄우지 않습니다.
	 *
	 * 캐시된 응답은 수십 ms 만에 오는데 그때마다 로더가 한 번 번쩍이면
	 * 화면이 더 느려 보인다. 0을 주면 즉시 띄웁니다.
	 */
	delayMs?: number;
	className?: string;
	/** 페이드아웃이 끝난 뒤 호출 — 부모에서 언마운트할 때 씁니다 */
	onExited?: () => void;
};

/* offset-path 미지원(구형 Safari 등)이면 점을 버리고 점선 궤도만 남긴다 */
const HAS_MOTION_PATH =
	typeof CSS !== "undefined" &&
	typeof CSS.supports === "function" &&
	CSS.supports("offset-path", 'path("M0 0L1 1")');

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** 별의 반짝임 타이밍 — 자기 궤도의 점이 도착하는 시점에 키프레임 0%를 맞춘다.
    궤도에 점이 n개면 한 바퀴에 n번 지나가므로 주기는 T/n이고,
    첫 통과 시점은 (f mod 1/n)·T다. --st-dur에 상대적으로 두어
    duration을 바꿔도 동기가 유지된다. */
const STAR_TIMINGS = STARS.map((star, i) => {
	const share = 1 / ORBITS[star.orbit].dots;
	const firstPass = star.f % share;
	return {
		"--st-flash-dur": `calc(var(--st-dur) * ${share.toFixed(4)})`,
		"--st-flash-delay": `calc(var(--st-dur) * ${(firstPass - share).toFixed(4)})`,
		"--st-stagger": String(i),
	} as CSSProperties;
});

/** 궤도마다 dots 개수만큼, 위상을 균등하게 나눠 배치한 점들 */
const DOTS = ORBITS.flatMap((orbit, orbitIndex) =>
	Array.from({ length: orbit.dots }, (_, k) => ({
		key: `${orbitIndex}-${k}`,
		primary: k === 0,
		style: {
			"--st-orbit": `path("${orbit.d}")`,
			"--st-phase": String(k / orbit.dots),
		} as CSSProperties,
	})),
);

export default function StarttooLoader({
	variant = "block",
	visible = true,
	label = "불러오는 중…",
	progress,
	size,
	durationMs,
	slowAfterMs = 8000,
	delayMs = 300,
	className,
	onExited,
}: StarttooLoaderProps) {
	const determinate = progress !== undefined;

	// 짧게 끝나는 요청에서 로더가 번쩍이지 않게 잠깐 기다렸다 띄운다.
	const [ready, setReady] = useState(delayMs === 0);
	useEffect(() => {
		if (delayMs === 0) {
			setReady(true);
			return undefined;
		}
		// 다시 로딩이 시작되면 지연도 처음부터 — 두 번째 로딩만 즉시 뜨면 어색하다.
		setReady(false);
		if (!visible) return undefined;
		const timer = setTimeout(() => setReady(true), delayMs);
		return () => clearTimeout(timer);
	}, [delayMs, visible]);

	// 오래 걸릴 때만 안심 문구를 띄운다 (진행률이 보이면 불필요)
	const [slow, setSlow] = useState(false);
	useEffect(() => {
		if (!visible || determinate) {
			setSlow(false);
			return undefined;
		}
		const timer = setTimeout(() => setSlow(true), slowAfterMs);
		return () => {
			clearTimeout(timer);
			setSlow(false);
		};
	}, [visible, determinate, slowAfterMs]);

	// 페이드아웃(0.18s)이 끝난 뒤 부모에게 알린다. transitionend 이벤트는
	// 백그라운드 탭처럼 합성이 멈춘 상황에서 오지 않을 수 있어 타이머로 보장한다.
	useEffect(() => {
		if (visible || !onExited) return undefined;
		const timer = setTimeout(onExited, 240);
		return () => clearTimeout(timer);
	}, [visible, onExited]);

	// 지연 구간에는 자리만 비워 둔다. 훅은 위에서 이미 다 돌았으므로
	// 페이드아웃·onExited 처리에는 영향이 없다.
	if (!ready) return null;

	const p = determinate ? clamp01((progress as number) / 100) : 0;

	const rootStyle: CSSProperties = {
		...(size !== undefined ? { "--st-w": `${size}px` } : {}),
		...(durationMs !== undefined ? { "--st-dur": `${durationMs}ms` } : {}),
		...(determinate ? { "--st-p": String(p) } : {}),
	} as CSSProperties;

	const text = label ?? "불러오는 중";

	return (
		<div
			className={className ? `st-load ${className}` : "st-load"}
			data-variant={variant}
			data-state={visible ? "loading" : "idle"}
			data-mode={determinate ? "determinate" : "indeterminate"}
			data-motion-path={String(HAS_MOTION_PATH)}
			data-slow={slow}
			style={rootStyle}
			role={determinate ? "progressbar" : "status"}
			aria-live={determinate ? "off" : "polite"}
			aria-busy={visible}
			aria-label={label ?? "불러오는 중"}
			{...(determinate
				? {
						"aria-valuemin": 0,
						"aria-valuemax": 100,
						"aria-valuenow": Math.round(p * 100),
					}
				: {})}
		>
			{variant === "mark" ? (
				<svg
					className="st-load__art"
					viewBox={MARK_VIEW_BOX}
					aria-hidden="true"
				>
					<path className="st-load__pip" d={MARK_STAR} />
				</svg>
			) : (
				<svg className="st-load__art" viewBox={VIEW_BOX} aria-hidden="true">
					<g className="st-load__mark">
						{WORDMARK.map((glyph, i) => (
							<path
								key={i}
								d={glyph.d}
								{...(glyph.stroked ? { "data-stroked": "" } : {})}
							/>
						))}
					</g>
					<g className="st-load__orbits">
						{ORBITS.map((orbit, i) => (
							<g key={i}>
								<path className="st-load__track" d={orbit.d} />
								<path
									className="st-load__fill"
									d={orbit.d}
									pathLength={1000}
									/* pathLength=1000이라 1px = 궤도의 0.1% */
									style={
										determinate
											? { strokeDashoffset: `${(1 - p) * 1000}px` }
											: undefined
									}
								/>
							</g>
						))}
					</g>
					<g className="st-load__stars">
						{STARS.map((star, i) => (
							<path
								key={i}
								className="st-load__star"
								d={star.d}
								style={STAR_TIMINGS[i]}
							/>
						))}
					</g>
					<g className="st-load__dots">
						{DOTS.map((dot) => (
							<circle
								key={dot.key}
								className="st-load__dot"
								r={DOT_RADIUS}
								style={dot.style}
								{...(dot.primary ? { "data-primary": "" } : {})}
							/>
						))}
					</g>
				</svg>
			)}

			{label !== null && (
				<div className="st-load__text">
					<span className="st-load__label">
						{determinate ? `${text} ${Math.round(p * 100)}%` : text}
					</span>
					<span className="st-load__slow">
						생각보다 오래 걸리고 있어요. 계속 시도 중입니다.
					</span>
				</div>
			)}
		</div>
	);
}
