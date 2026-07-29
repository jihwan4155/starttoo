import { useEffect, useRef, useState } from "react";

export type CameraStatus =
	/** 아직 시작 전 */
	| "idle"
	/** 권한 요청 중 */
	| "requesting"
	/** 스트림 재생 중 */
	| "active"
	/** 사용자가 권한 거부 */
	| "denied"
	/** getUserMedia 없음 — HTTP(비보안) 컨텍스트 등 */
	| "unsupported"
	/** 그 외 오류 (카메라 없음 등) */
	| "error";

type UseCameraResult = {
	videoRef: React.RefObject<HTMLVideoElement | null>;
	status: CameraStatus;
	/** denied/error 시 사용자 재시도 */
	retry: () => void;
};

/**
 * 후면 카메라 스트림을 <video>에 연결한다.
 * getUserMedia는 HTTPS(또는 localhost) 보안 컨텍스트에서만 존재하므로,
 * HTTP LAN 접속 등에서는 status="unsupported"로 떨어진다.
 */
export function useCamera(enabled = true): UseCameraResult {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const [status, setStatus] = useState<CameraStatus>("idle");
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		if (!enabled) return;

		if (!navigator.mediaDevices?.getUserMedia) {
			setStatus("unsupported");
			return;
		}

		let stream: MediaStream | null = null;
		let cancelled = false;
		setStatus("requesting");

		navigator.mediaDevices
			.getUserMedia({ video: { facingMode: "environment" }, audio: false })
			.then((mediaStream) => {
				if (cancelled) {
					mediaStream.getTracks().forEach((track) => track.stop());
					return;
				}
				stream = mediaStream;
				const video = videoRef.current;
				if (video) {
					video.srcObject = mediaStream;
					// Chrome 자동재생 정책 회피 (muted + play)
					video.muted = true;
					void video.play().catch(() => {});
				}
				setStatus("active");
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				const name = err instanceof DOMException ? err.name : "";
				setStatus(
					name === "NotAllowedError" || name === "SecurityError"
						? "denied"
						: "error",
				);
			});

		return () => {
			cancelled = true;
			stream?.getTracks().forEach((track) => track.stop());
		};
	}, [enabled, attempt]);

	return { videoRef, status, retry: () => setAttempt((n) => n + 1) };
}
