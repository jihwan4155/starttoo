import { useEffect, useRef, useState } from "react";
import {
	estimateDepth,
	segmentPerson,
	type DepthMap,
	type PersonMask,
} from "./inkproof/image-engine";

export type BodyScanStatus = "idle" | "loading" | "ready" | "error";

export type BodyScanResult = {
	status: BodyScanStatus;
	bodyImage: HTMLImageElement | null;
	personMask: PersonMask | null;
	depth: DepthMap | null;
	progress: number;
	label: string;
	error: string | null;
};

const IDLE: BodyScanResult = {
	status: "idle",
	bodyImage: null,
	personMask: null,
	depth: null,
	progress: 0,
	label: "",
	error: null,
};

/** 다른 출처의 이미지는 blob으로 변환해 캔버스 CORS 오염을 막는다. */
function isCrossOrigin(url: string): boolean {
	if (!/^https?:/i.test(url)) return false;
	try {
		return new URL(url, window.location.href).origin !== window.location.origin;
	} catch {
		return false;
	}
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
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

/**
 * 신체 사진 선택 후 다음 단계(도안 선택)로 넘어가는 동안 백그라운드에서
 * 인물 분할 마스크와 3D 굴곡(depth)을 미리 계산한다. 도안과 무관하므로
 * 사용자가 도안을 고르는 사이에 스캔이 끝나 3D 단계 진입이 빨라진다.
 */
export function useBodyScan(
	photoUrl: string | null,
	enabled: boolean,
): BodyScanResult {
	const [state, setState] = useState<BodyScanResult>(IDLE);
	const requestRef = useRef(0);

	useEffect(() => {
		if (!enabled || !photoUrl) {
			setState(IDLE);
			return undefined;
		}

		const requestId = ++requestRef.current;
		let cancelled = false;
		const alive = () => !cancelled && requestRef.current === requestId;

		setState({
			...IDLE,
			status: "loading",
			label: "신체 사진을 불러오는 중",
			progress: 4,
		});

		const run = async () => {
			try {
				const photo = await loadImage(photoUrl);
				if (!alive()) return;
				setState((current) => ({
					...current,
					bodyImage: photo,
					label: "신체 영역 분리 준비 중",
					progress: 8,
				}));

				const mask = await segmentPerson(photo, (label, progress) => {
					if (!alive()) return;
					setState((current) => ({
						...current,
						label,
						progress: 8 + (progress ?? 0) * 0.42,
					}));
				});
				if (!alive()) return;
				setState((current) => ({
					...current,
					personMask: mask,
					label: "3D 굴곡 분석 준비 중",
					progress: 52,
				}));

				const depthResult = await estimateDepth(
					photo,
					mask,
					(label, progress) => {
						if (!alive()) return;
						setState((current) => ({
							...current,
							label,
							progress: 52 + (progress ?? 0) * 0.48,
						}));
					},
				);
				if (!alive()) return;
				setState((current) => ({
					...current,
					depth: depthResult,
					status: "ready",
					label: "분석 완료",
					progress: 100,
				}));
			} catch (scanError) {
				if (!alive()) return;
				const message =
					scanError instanceof Error
						? scanError.message
						: "신체 사진 분석 중 오류가 발생했습니다.";
				setState((current) => ({ ...current, status: "error", error: message }));
			}
		};

		void run();
		return () => {
			cancelled = true;
			requestRef.current += 1;
		};
	}, [photoUrl, enabled]);

	return state;
}
