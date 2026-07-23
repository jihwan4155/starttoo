import { useEffect, useRef, useState } from "react";
import { InkproofEngine } from "./inkproof/engine";

type StageState = "wait" | "busy" | "done" | "error";

type PipelineStage = {
	id: "mask" | "part" | "depth";
	label: string;
	state: StageState;
	detail: string;
};

const INITIAL_STAGES: PipelineStage[] = [
	{ id: "mask", label: "신체 마스크 생성", state: "wait", detail: "" },
	{ id: "part", label: "부위 인식", state: "wait", detail: "" },
	{ id: "depth", label: "뎁스맵 생성", state: "wait", detail: "" },
];

type Simulation3DStepProps = {
	designUrl: string | null;
	photoUrl: string | null;
};

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
		img.src = url;
	});
}

/**
 * 3D 메시 타투 시뮬레이션 단계 (STEP 3)
 * 진입 즉시 AI 파이프라인(신체 마스크 → 부위 인식 → 뎁스맵)을 실행하고,
 * 완료되면 드래그·휠·Shift+휠 배치 + 바램(에이징) 슬라이더 + 저장을 한 화면에서 제공한다
 */
export default function Simulation3DStep({
	designUrl,
	photoUrl,
}: Simulation3DStepProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const engineRef = useRef<InkproofEngine | null>(null);
	const pipelineStartedRef = useRef(false);

	const [ready, setReady] = useState(false);
	const [initError, setInitError] = useState<string | null>(null);
	const [stages, setStages] = useState<PipelineStage[]>(INITIAL_STAGES);
	const [pipelineDone, setPipelineDone] = useState(false);
	const [age, setAge] = useState(35);

	// 엔진 초기화 + 이미지 로드 (마운트 시 1회)
	useEffect(() => {
		const host = hostRef.current;
		const canvas = canvasRef.current;
		if (!host || !canvas || !designUrl || !photoUrl) return undefined;

		let engine: InkproofEngine;
		try {
			engine = new InkproofEngine(canvas, host);
		} catch (e) {
			setInitError(e instanceof Error ? e.message : "WebGL 초기화에 실패했습니다.");
			return undefined;
		}
		engineRef.current = engine;

		let cancelled = false;
		Promise.all([loadImage(photoUrl), loadImage(designUrl)])
			.then(([photo, design]) => {
				if (cancelled) return;
				engine.setPhoto(photo);
				engine.setTattoo(design);
				engine.setAge(0.35);
				setReady(true);
			})
			.catch((e: Error) => {
				if (!cancelled) setInitError(e.message);
			});

		// 하단 패널이 나타나는 등 호스트 크기가 바뀌면 캔버스도 다시 맞춘다
		// (안 하면 캔버스가 크게 남아 상단 STEP 문구를 덮는다)
		const observer = new ResizeObserver(() => engine.resize());
		observer.observe(host);
		return () => {
			cancelled = true;
			observer.disconnect();
			engine.destroy();
			engineRef.current = null;
		};
		// designUrl/photoUrl은 단계 진입 시점에 고정된 값 — 마운트 1회만 초기화
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// STEP 3 진입(마운트) 직후 바로 AI 파이프라인 실행 (신체 마스크 → 부위 인식 → 뎁스맵)
	useEffect(() => {
		const engine = engineRef.current;
		if (!engine || !ready || pipelineStartedRef.current) return;
		pipelineStartedRef.current = true;

		const setStage = (id: PipelineStage["id"], state: StageState, detail = "") =>
			setStages((prev) =>
				prev.map((s) => (s.id === id ? { ...s, state, detail } : s)),
			);

		const run = async () => {
			const steps: {
				id: PipelineStage["id"];
				exec: (onProgress: (m: string) => void) => Promise<void>;
			}[] = [
				{ id: "mask", exec: (p) => engine.runBodyMask(p) },
				{ id: "part", exec: (p) => engine.runPartParsing(p) },
				{ id: "depth", exec: (p) => engine.runDepthMap(p) },
			];
			for (const step of steps) {
				setStage(step.id, "busy");
				try {
					 
					await step.exec((message) => setStage(step.id, "busy", message));
					setStage(step.id, "done");
				} catch (e) {
					setStage(
						step.id,
						"error",
						e instanceof Error ? e.message : "실패 (네트워크를 확인해주세요)",
					);
				}
			}
			setPipelineDone(true);
		};
		run();
	}, [ready]);

	// 파이프라인 완료로 하단 패널이 등장해 호스트 크기가 바뀐 뒤 캔버스를 다시 맞춘다
	useEffect(() => {
		const t = setTimeout(() => engineRef.current?.resize(), 50);
		return () => clearTimeout(t);
	}, [pipelineDone]);

	const handleAgeChange = (value: number) => {
		setAge(value);
		engineRef.current?.setAge(value / 100);
	};

	const handleSave = async () => {
		const blob = await engineRef.current?.toBlob();
		if (!blob) return;
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = "starttoo-simulation.png";
		a.click();
		URL.revokeObjectURL(a.href);
	};

	if (!designUrl || !photoUrl) {
		return (
			<p className="text-center text-[14px] font-light text-black/50">
				이전 단계에서 도안과 신체 사진을 먼저 올려주세요
			</p>
		);
	}

	const processing = !pipelineDone;

	return (
		<div className="flex size-full min-h-0 flex-col items-center gap-3">
			<div
				ref={hostRef}
				className="relative flex min-h-0 w-full flex-1 items-center justify-center">
				{/* 캔버스를 감싸는 래퍼 — 힌트·오버레이가 사진 영역 밖으로 나가지 않게 기준점 역할 */}
				<div className="relative">
					<canvas
						ref={canvasRef}
						className="block cursor-grab rounded-[12px] shadow-md"
					/>
					{/* 조작 힌트 — 사진 안 우하단 구석에 표시 */}
					{ready && !processing && (
						<span className="pointer-events-none absolute bottom-2 right-2 whitespace-nowrap rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-light text-white/90">
							드래그 이동 · 휠 확대/축소 · Shift+휠 회전
						</span>
					)}
				</div>
				{initError && (
					<p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[13px] text-brand">
						{initError}
					</p>
				)}
				{/* AI 파이프라인 진행 오버레이 */}
				{processing && (
					<div className="absolute inset-0 flex items-center justify-center rounded-[12px] bg-black/55">
						<div className="w-[260px] rounded-xl bg-white px-5 py-4 shadow-lg">
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
									</div>
									{stage.detail && (
										<p className="ml-5 mt-0.5 text-[11px] font-light text-black/50">
											{stage.detail}
										</p>
									)}
								</div>
							))}
						</div>
					</div>
				)}
			</div>

			{/* 일부 단계 실패 시 안내 (실패해도 근사값으로 시뮬레이션은 계속 동작) */}
			{pipelineDone && stages.some((s) => s.state === "error") && (
				<p className="shrink-0 text-center text-[11px] font-light text-brand">
					{stages
						.filter((s) => s.state === "error")
						.map((s) => s.label)
						.join(" · ")}
					에 실패했어요. 근사값으로 표시 중입니다 (네트워크 확인 후 다시
					시도해주세요)
				</p>
			)}

			{/* 파이프라인 완료 후: 바램(에이징) 슬라이더 + 저장 */}
			{pipelineDone && (
				<div className="w-full max-w-[480px] shrink-0">
					<div className="flex items-baseline justify-between">
						<span className="text-[13px] text-black">
							<span className="mr-2 font-mono text-[11px] tracking-widest text-brand">
								05
							</span>
							바램 (탈색·청록·소프트닝)
						</span>
						<span className="font-mono text-[12px] font-semibold text-brand">
							{age}%
						</span>
					</div>
					<input
						type="range"
						min={0}
						max={100}
						value={age}
						onChange={(e) => handleAgeChange(Number(e.target.value))}
						aria-label="바램 (탈색·청록·소프트닝)"
						className="mt-1 w-full accent-brand"
					/>
					<div className="mt-2 flex justify-center">
						<button
							type="button"
							onClick={handleSave}
							className="inline-flex h-[40px] min-w-[160px] items-center justify-center rounded-[50px] bg-brand text-[14px] font-semibold text-white transition hover:brightness-95">
							내 컴퓨터에 저장
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
