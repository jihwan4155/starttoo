import { useState } from "react";
import { useParams } from "react-router-dom";
import ArCustomizeScreen from "../components/simulation/ArCustomizeScreen";

/**
 * 폰이 QR로 진입하는 AR 커스텀 페이지 (`/simulations/ar/:sessionId`).
 * 앱 셸(MainLayout) 없이 풀스크린으로 카메라 화면에 집중한다.
 * 지금은 목업 — 세션 연결(/connect)·캡처 업로드(/composites)는 이후 연동.
 */
export default function ArJoinPage() {
	const { sessionId } = useParams();
	const [capturedUrl, setCapturedUrl] = useState<string | null>(null);

	return (
		<div className="flex min-h-screen flex-col bg-neutral-950 text-white">
			<header className="flex items-center justify-between px-5 py-4">
				<span className="text-[15px] font-extrabold tracking-tight">
					STARTTOO <span className="font-light text-white/50">AR</span>
				</span>
				<span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-mono text-white/50">
					{sessionId ? `#${sessionId.slice(0, 8)}` : "no-session"}
				</span>
			</header>

			{/* 엔진은 항상 마운트 유지 (캡처 시 언마운트하면 cv 정리 중 화면이 죽을 수 있음).
			    결과는 위에 오버레이로 띄운다 — PoC와 동일한 방식. */}
			<main className="flex flex-1 items-center justify-center px-5 pb-8">
				<ArCustomizeScreen onCapture={setCapturedUrl} />
			</main>

			{capturedUrl && (
				<div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-neutral-950/95 px-5 text-center backdrop-blur">
					<div className="w-56 overflow-hidden rounded-[16px] ring-1 ring-white/15">
						<img
							src={capturedUrl}
							alt="캡처 결과"
							className="w-full object-cover"
						/>
					</div>
					<div>
						<p className="text-[18px] font-bold">캡처 완료!</p>
						<p className="mt-1 text-[14px] font-light leading-6 text-white/60">
							PC 화면에서 결과를 확인하고
							<br />
							저장할 수 있어요.
						</p>
					</div>
					<button
						type="button"
						onClick={() => setCapturedUrl(null)}
						className="text-[14px] font-semibold text-brand">
						다시 촬영하기
					</button>
				</div>
			)}
		</div>
	);
}
