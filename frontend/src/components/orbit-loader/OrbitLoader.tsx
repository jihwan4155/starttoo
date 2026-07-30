import { useEffect, useId, useState, type CSSProperties } from "react";
import "./OrbitLoader.css";
import { DASH, ORBITS, STARS, VIEW_BOX } from "./orbitGeometry";

/* ─────────────────────────────────────────────
   starttoo 로고의 공전 부분만 떼어낸 로딩 인디케이터.

   외부 의존성 없음 (React 만 필요). 이미지 파일도 쓰지 않습니다 —
   궤도와 별은 모두 원본 로고에서 측정해 뽑아낸 SVG 경로(orbitGeometry.ts)입니다.

   · 궤도  : 원본 점선 59조각의 중심을 이은 닫힌 곡선 2개.
             거기에 실측 점선 규격(길이 51.2 / 굵기 13.6 / 한 바퀴 44개)을 입힙니다.
   · 별    : 원본 별 3개의 외곽선. 이것만 궤도를 따라 움직이며,
             시작 위치도 원본에 있던 자리와 같습니다.
   ───────────────────────────────────────────── */

export type OrbitLoaderProps = {
	/** false가 되면 페이드아웃 */
	visible?: boolean;
	/** 0~100. 생략하면 숫자를 감춥니다 */
	progress?: number;
	/** 진행 문구. null 이면 문구 줄을 아예 감춥니다 */
	label?: string | null;
	/** 별이 궤도를 한 바퀴 도는 시간(ms). 작을수록 빠릅니다 */
	durationMs?: number;
	/** 궤도 그래픽의 가로 크기(px). 세로는 원본 비율로 따라옵니다 */
	size?: number;
	/** 점선 궤도 표시 (끄면 별만 떠서 움직입니다) */
	showTrack?: boolean;
	/** true면 화면 전체를 덮지 않고 그 자리에 그립니다 (카드/버튼 안에 넣을 때) */
	inline?: boolean;
	className?: string;
	/** 페이드아웃이 끝난 뒤 호출 — 부모에서 언마운트할 때 씁니다 */
	onExited?: () => void;
};

function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReduced(mq.matches);
		const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
	return reduced;
}

export default function OrbitLoader({
	visible = true,
	progress,
	label = "궤도 정렬 중",
	durationMs = 3000,
	size = 200,
	showTrack = true,
	inline = false,
	className,
	onExited,
}: OrbitLoaderProps) {
	const reduced = usePrefersReducedMotion();
	// 로더가 두 개 이상 떠도 mpath 참조가 섞이지 않도록 id를 격리합니다
	const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
	const dur = `${durationMs / 1000}s`;

	/* 작게 줄이면 원본 굵기(13.6)가 화면에서 1px 아래로 내려가 흐려집니다.
	   최소 1.1px는 되도록 경로 단위 굵기를 보정합니다. */
	const strokeWidth = Math.max(DASH.width, (1.1 * VIEW_BOX.w) / size);

	return (
		<div
			className={className ? `orbitLoader ${className}` : "orbitLoader"}
			style={{ "--orbit-size": `${size}px` } as CSSProperties}
			data-done={!visible}
			data-inline={inline}
			role="status"
			aria-live="polite"
			aria-label={label ?? "불러오는 중"}
			onTransitionEnd={(e) => {
				// 여러 속성이 함께 끝나므로 opacity 하나만 받습니다
				if (e.propertyName === "opacity" && !visible) onExited?.();
			}}
		>
			<div className="orbitLoader__stage">
				<svg
					className="orbitLoader__svg"
					viewBox={`0 0 ${VIEW_BOX.w} ${VIEW_BOX.h}`}
					aria-hidden="true"
				>
					{ORBITS.map((orbit, i) => {
						const pitch = orbit.length / orbit.perLap;
						// 둥근 끝이 양쪽으로 굵기/2씩 더 나오므로 그만큼 빼서 그립니다
						const on = DASH.length - strokeWidth;
						return (
							<path
								key={i}
								id={`${uid}-orbit-${i}`}
								className="orbitLoader__track"
								d={orbit.d}
								strokeWidth={showTrack ? strokeWidth : 0}
								strokeDasharray={`${on} ${pitch - on}`}
								/* 첫 점선의 가운데를 경로 시작점(원본 첫 조각 위치)에 맞춥니다 */
								strokeDashoffset={(DASH.length - strokeWidth) / 2}
							/>
						);
					})}

					{STARS.map((star, i) => (
						<g
							key={i}
							/* animateMotion이 이 g의 위치를 궤도 위로 옮깁니다.
							   모션 최소화 설정이면 원본에 있던 자리에 그대로 세워둡니다. */
							transform={reduced ? `translate(${star.at[0]} ${star.at[1]})` : undefined}
						>
							<path className="orbitLoader__star" d={star.d} />
							{!reduced && (
								<animateMotion
									dur={dur}
									/* 음수 begin = 주기의 phase만큼 앞당겨 시작 = 원본과 같은 배치.
									   durationMs를 바꿔도 세 별의 상대 위치가 유지됩니다. */
									begin={star.phase === 0 ? "0s" : `-${(durationMs * star.phase) / 1000}s`}
									repeatCount="indefinite"
								>
									{/* 구버전 Safari가 href를 무시하므로 xlink:href도 함께 둡니다 */}
									<mpath
										href={`#${uid}-orbit-${star.loop}`}
										xlinkHref={`#${uid}-orbit-${star.loop}`}
									/>
								</animateMotion>
							)}
						</g>
					))}
				</svg>
			</div>

			{label !== null && (
				<p className="orbitLoader__status">
					<span>{label}</span>
					{progress !== undefined && (
						<>
							<b>{Math.round(progress)}</b>%
						</>
					)}
				</p>
			)}
		</div>
	);
}
