import { useCallback, useEffect, useState } from "react";
import {
	closeArSession,
	createArSession,
	getArSession,
	subscribeArSessionEvents,
} from "../services/simulationApi";
import type { ArComposite, ArSessionStatus } from "../types/simulation";

/**
 * QR에 실을 폰 진입 주소의 오리진.
 *
 * <p>기본은 현재 오리진이다. 다만 로컬 개발에서는 PC를 localhost로 열어야
 * 소셜 로그인이 되고(리다이렉트 URI가 콘솔에 등록된 값이어야 한다), 폰은
 * localhost로 들어올 수 없다. 이때만 `VITE_AR_JOIN_ORIGIN`에 PC의 LAN 주소를
 * 넣어 QR만 그쪽을 가리키게 한다. 폰이 여는 AR 페이지는 로그인이 필요 없다.
 */
function resolveJoinOrigin(): string {
	const override = import.meta.env.VITE_AR_JOIN_ORIGIN;
	if (typeof override === "string" && override.trim()) {
		return override.trim().replace(/\/+$/, "");
	}
	return window.location.origin;
}

/** 서버 상한 — AR_SESSION_MAX_DESIGNS. 넘겨 보내면 INVALID_REQUEST다 */
const MAX_SESSION_DESIGNS = 20;

type UseArSessionOptions = {
	/** false면 세션을 만들지 않는다 (AR 2단계에 들어왔을 때만 켠다) */
	enabled?: boolean;
	/**
	 * 폰 보관함에 띄울 도안(tattooSeq) — PC가 자기 보관함을 실어 보낸다.
	 *
	 * QR로 들어온 폰은 비로그인이라 보관함을 스스로 못 읽는다. 여기서 넘긴 도안만
	 * /connect 응답에 presigned URL로 담겨 폰 화면에 나온다. 상한을 넘으면
	 * 앞에서부터 자른다 — 호출부가 최신순으로 넘기는 것을 전제한다.
	 */
	designSeqs?: number[];
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
	designSeqs,
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

	// 보관함은 배열이라 렌더마다 신원이 바뀐다. 그대로 effect 의존성에 넣으면
	// 세션을 끝없이 다시 발급하므로 값으로 비교할 수 있게 문자열로 접는다.
	const designKey = (designSeqs ?? [])
		.slice(0, MAX_SESSION_DESIGNS)
		.join(",");

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
				const seqs = designKey ? designKey.split(",").map(Number) : [];
				const session = await createArSession(
					seqs.length ? { designSeqs: seqs } : {},
				);
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
	}, [enabled, nonce, designKey]);

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

	const joinUrl = sessionId ? `${resolveJoinOrigin()}/simulations/ar/${sessionId}` : null;

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
