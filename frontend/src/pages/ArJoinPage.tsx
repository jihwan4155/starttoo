import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import ArCustomizeScreen from "../components/simulation/ArCustomizeScreen";
import {
	CloseIcon,
	MobileHeader,
	StepTitle,
} from "../components/simulation/MobileChrome";
import { ApiError } from "../services/api";
import { connectArSession, uploadArComposite } from "../services/simulationApi";
import type { ArSessionDesign } from "../types/simulation";

/**
 * 폰이 QR로 진입하는 AR 커스텀 페이지 (`/simulations/ar/:sessionId`).
 *
 * <p>앱 셸(MainLayout) 없이 풀스크린이지만, 화면 모양은 폰에서 바로 들어온
 * 모바일 AR 단계(MobileSimulationFlow)와 동일하게 맞춘다. 캡처 뒤에는 PC로
 * 돌아가는 흐름이라 홈·뒤로가기 버튼은 두지 않는다.
 *
 * <p>이 페이지는 비로그인이다. sessionId로 /connect 해서 받은 sessionToken으로만
 * 업로드하고, 도안 목록도 그 응답에서 받는다.
 */

type ConnectPhase = "connecting" | "ready" | "error";
type UploadPhase = "uploading" | "done" | "failed";

type ConnectError = { title: string; description: string; canRetry: boolean };

function describeConnectError(error: unknown): ConnectError {
	const status = error instanceof ApiError ? error.status : 0;
	// sessionId가 UUID 형식이 아니면 백엔드가 400을 준다 — 재시도해도 달라지지 않는다
	if (status === 400) {
		return {
			title: "잘못된 주소예요",
			description: "PC 화면의 QR을 다시 찍어 주세요.",
			canRetry: false,
		};
	}
	if (status === 404) {
		return {
			title: "세션을 찾을 수 없어요",
			description: "QR이 오래됐을 수 있어요. PC에서 QR을 다시 받아 주세요.",
			canRetry: false,
		};
	}
	if (status === 409) {
		return {
			title: "이미 다른 기기가 연결됐어요",
			description: "한 세션에는 폰 한 대만 연결할 수 있어요.",
			canRetry: false,
		};
	}
	if (status === 410) {
		return {
			title: "세션이 만료됐어요",
			description: "PC 화면에서 QR을 다시 받은 뒤 새로 찍어 주세요.",
			canRetry: false,
		};
	}
	return {
		title: "연결하지 못했어요",
		description: "네트워크 상태를 확인하고 다시 시도해 주세요.",
		canRetry: true,
	};
}

/** 캡처 dataURL을 업로드용 Blob으로 바꾼다 */
async function toBlob(dataUrl: string): Promise<Blob> {
	const response = await fetch(dataUrl);
	return response.blob();
}

export default function ArJoinPage() {
	const { sessionId } = useParams();
	const [phase, setPhase] = useState<ConnectPhase>("connecting");
	const [connectError, setConnectError] = useState<ConnectError | null>(null);
	const [designs, setDesigns] = useState<ArSessionDesign[]>([]);
	const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
	const [uploadPhase, setUploadPhase] = useState<UploadPhase>("uploading");
	const [retryKey, setRetryKey] = useState(0);

	const sessionTokenRef = useRef<string | null>(null);

	useEffect(() => {
		if (!sessionId) {
			setPhase("error");
			setConnectError(describeConnectError(new ApiError(404, "NOT_FOUND", "")));
			return;
		}
		let cancelled = false;
		setPhase("connecting");

		void (async () => {
			try {
				const session = await connectArSession(sessionId);
				if (cancelled) return;
				sessionTokenRef.current = session.sessionToken;
				setDesigns(session.designs ?? []);
				setPhase("ready");
			} catch (error) {
				if (cancelled) return;
				setConnectError(describeConnectError(error));
				setPhase("error");
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [sessionId, retryKey]);

	// 캡처 → 미리보기를 즉시 띄우고 업로드는 뒤에서 진행한다
	const upload = useCallback(
		async (dataUrl: string) => {
			const token = sessionTokenRef.current;
			if (!sessionId || !token) {
				setUploadPhase("failed");
				return;
			}
			setUploadPhase("uploading");
			try {
				await uploadArComposite(sessionId, token, await toBlob(dataUrl));
				setUploadPhase("done");
			} catch {
				setUploadPhase("failed");
			}
		},
		[sessionId],
	);

	const handleCapture = (dataUrl: string) => {
		setCapturedUrl(dataUrl);
		void upload(dataUrl);
	};

	const title = "타투 시뮬레이션 - 실시간(AR)";

	if (phase !== "ready") {
		const connecting = phase === "connecting";
		return (
			<div className="min-h-screen bg-surface px-4 pb-10 pt-[70px]">
				<MobileHeader title={title} />
				<div className="mx-auto flex max-w-[560px] flex-col items-center gap-4 pt-24 text-center">
					{connecting ? (
						<>
							<span className="size-2.5 animate-pulse rounded-full bg-amber-400" />
							<p className="text-[16px] font-semibold text-black/70">
								PC 화면과 연결하는 중…
							</p>
						</>
					) : (
						<>
							<h2 className="text-[20px] font-bold">{connectError?.title}</h2>
							<p className="text-[14px] leading-6 text-[#777]">
								{connectError?.description}
							</p>
							{connectError?.canRetry && (
								<button
									type="button"
									onClick={() => setRetryKey((current) => current + 1)}
									className="mt-2 h-11 rounded-full bg-brand px-8 text-[15px] font-semibold text-white">
									다시 시도
								</button>
							)}
						</>
					)}
				</div>
			</div>
		);
	}

	return (
		<>
			{/* 앱 셸이 없으므로 고정 헤더(44px) 높이만큼 직접 띄운다 */}
			<div className="min-h-screen bg-surface px-4 pb-10 pt-[70px]">
				<MobileHeader title={title} />
				{/* 엔진은 항상 마운트 유지 (캡처 시 언마운트하면 cv 정리 중 화면이 죽을 수 있음).
				    결과는 위에 오버레이로 띄운다 — PoC와 동일한 방식. */}
				<div className="mx-auto max-w-[560px]">
					<StepTitle className="mb-4">카메라에 마커를 맞춰주세요</StepTitle>
					<ArCustomizeScreen
						onCapture={handleCapture}
						designs={designs.map((design) => ({
							seq: design.designSeq,
							name: `도안 ${design.designSeq}`,
							url: design.imageUrl,
						}))}
					/>
				</div>
			</div>

			{capturedUrl && (
				<div
					className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4"
					role="presentation"
					onClick={() => setCapturedUrl(null)}>
					<div
						className="relative w-full max-w-[344px] rounded-[12px] bg-white px-8 pb-7 pt-11 text-center"
						role="dialog"
						aria-modal="true"
						aria-label="AR 캡처 완료"
						onClick={(event) => event.stopPropagation()}>
						<button
							type="button"
							aria-label="닫기"
							onClick={() => setCapturedUrl(null)}
							className="absolute right-4 top-4 text-[#40505D]">
							<CloseIcon />
						</button>
						<h2 className="text-[22px] font-bold">
							{uploadPhase === "failed" ? "전송하지 못했어요" : "캡처 완료"}
						</h2>
						<div className="mx-auto mt-5 w-40 overflow-hidden rounded-[12px] border border-[#E8E8E8]">
							<img
								src={capturedUrl}
								alt="캡처 결과"
								className="w-full object-cover"
							/>
						</div>

						{uploadPhase === "uploading" && (
							<p className="mt-5 text-[15px] leading-6 text-[#555]">
								PC로 보내는 중…
							</p>
						)}
						{uploadPhase === "done" && (
							<p className="mt-5 text-[15px] leading-6 text-[#555]">
								PC 화면에서 결과를 확인하고
								<br />
								저장할 수 있어요.
							</p>
						)}
						{uploadPhase === "failed" && (
							<p className="mt-5 text-[15px] leading-6 text-[#555]">
								네트워크 상태를 확인하고
								<br />
								다시 보내 주세요.
							</p>
						)}

						<div className="mt-6 flex gap-3">
							{uploadPhase === "failed" && (
								<button
									type="button"
									onClick={() => void upload(capturedUrl)}
									className="h-11 flex-1 rounded-full bg-brand text-[15px] font-semibold text-white">
									다시 보내기
								</button>
							)}
							<button
								type="button"
								onClick={() => setCapturedUrl(null)}
								className="h-11 flex-1 rounded-full bg-[#E2E2E2] text-[15px] font-semibold text-[#555]">
								다시 촬영
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
