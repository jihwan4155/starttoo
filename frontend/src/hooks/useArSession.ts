import { useCallback, useEffect, useState } from "react";
import {
	closeArSession,
	createArSession,
	getArSession,
	subscribeArSessionEvents,
} from "../services/simulationApi";
import type { ArComposite, ArSessionStatus } from "../types/simulation";

type UseArSessionOptions = {
	/** false면 세션을 만들지 않는다 (AR 2단계에 들어왔을 때만 켠다) */
	enabled?: boolean;
};

type UseArSessionResult = {
	sessionId: string | null;
	/** QR에 실을 폰 진입 주소 */
	joinUrl: string | null;
	status: ArSessionStatus | "CREATING";
	phoneConnected: boolean;
	composites: ArComposite[];
	/** 폰에서 마지막으로 올라온 캡처 */
	latestComposite: ArComposite | null;
	error: string | null;
	/** 만료·오류 후 새 세션 발급 */
	restart: () => void;
};

/**
 * PC 쪽 AR 세션 수명 관리 — 세션 생성 → 폰 접속 대기 → 캡처 수신.
 *
 * <p>이벤트가 오면 상태를 직접 병합하지 않고 GET으로 다시 읽는다. 서버가 단일
 * 사실이고, 재연결로 이벤트를 놓쳐도 다음 조회에서 메꿔지기 때문이다
 * (useDmRealtime과 같은 방침).
 */
export default function useArSession({
	enabled = true,
}: UseArSessionOptions = {}): UseArSessionResult {
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [status, setStatus] = useState<ArSessionStatus | "CREATING">("CREATING");
	const [phoneConnected, setPhoneConnected] = useState(false);
	const [composites, setComposites] = useState<ArComposite[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [nonce, setNonce] = useState(0);

	const restart = useCallback(() => {
		setError(null);
		setStatus("CREATING");
		setPhoneConnected(false);
		setComposites([]);
		setNonce((current) => current + 1);
	}, []);

	// 세션 생성 — enabled가 켜질 때와 restart마다 새로 발급한다.
	// 취소 표식은 이 실행에만 속한 지역 변수로 둔다. ref로 공유하면 다음 실행이
	// 표식을 되돌려, 이미 버린 세션의 응답이 뒤늦게 상태를 덮어쓰고 그 세션은
	// 닫히지 않은 채 남는다.
	useEffect(() => {
		if (!enabled) return;
		let cancelled = false;
		let created: string | null = null;
		let expiryTimer: ReturnType<typeof setTimeout> | null = null;

		void (async () => {
			try {
				const session = await createArSession();
				if (cancelled) {
					void closeArSession(session.sessionId);
					return;
				}
				created = session.sessionId;
				setSessionId(session.sessionId);
				setStatus("CREATED");
				expiryTimer = setTimeout(() => {
					if (!cancelled) setStatus("EXPIRED");
				}, session.expiresInSeconds * 1000);
			} catch {
				if (!cancelled) {
					setError("QR 세션을 만들지 못했습니다. 다시 시도해 주세요.");
				}
			}
		})();

		return () => {
			cancelled = true;
			if (expiryTimer) clearTimeout(expiryTimer);
			if (created) void closeArSession(created);
			setSessionId(null);
		};
	}, [enabled, nonce]);

	// 이벤트 수신 → 세션 재조회
	useEffect(() => {
		if (!sessionId) return;
		let cancelled = false;

		const sync = async () => {
			try {
				const detail = await getArSession(sessionId);
				if (cancelled) return;
				setStatus(detail.status);
				setPhoneConnected(detail.phoneConnected);
				setComposites(detail.composites);
			} catch {
				// 일시적 실패는 다음 이벤트에서 다시 맞춰진다
			}
		};

		void sync();
		const unsubscribe = subscribeArSessionEvents((event) => {
			if (event.sessionId !== sessionId) return;
			void sync();
		});
		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [sessionId]);

	const joinUrl = sessionId
		? `${window.location.origin}/simulations/ar/${sessionId}`
		: null;

	return {
		sessionId,
		joinUrl,
		status,
		phoneConnected,
		composites,
		latestComposite: composites[composites.length - 1] ?? null,
		error,
		restart,
	};
}
