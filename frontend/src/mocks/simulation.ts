import demoTattoo from "../assets/images/demo-tattoo.png";
import starDesign from "../assets/ar/design-star.svg";
import vineDesign from "../assets/ar/design-vine.svg";
import { ApiError } from "../services/api";
import type {
	ArComposite,
	ArSessionDesign,
	ArSessionDetail,
	ArSimulationEvent,
	ConnectArSessionResponse,
	CreateArSessionResponse,
} from "../types/simulation";

/**
 * AR 세션 목 서버 — 백엔드 구현 전까지 PC 화면을 끝까지 만들어 보기 위한 대역.
 *
 * <p><b>한계를 분명히 해 둔다.</b> PC와 폰은 다른 기기·다른 브라우저라 프론트만으로는
 * 실제 전송을 흉내 낼 수 없다. 그래서 이 목은 "폰이 붙어서 캡처를 올린 것처럼" PC
 * 화면에서 타이머로 이벤트를 만들어 준다. 한 기기 안에서만 유효하며, 실제 기기 간
 * 왕복은 백엔드가 나와야 검증된다.
 *
 * <p>새로고침해도 대기 화면이 이어지도록 세션은 sessionStorage에 둔다.
 */

const STORAGE_KEY = "mock-ar-sessions";
const SESSION_TTL_SECONDS = 600;

/** 목에서 폰이 붙는 시점 / 첫 캡처가 올라오는 시점 */
const MOCK_CONNECT_DELAY_MS = 3_000;
const MOCK_CAPTURE_DELAY_MS = 8_000;

const MOCK_DESIGNS: ArSessionDesign[] = [
	{ designSeq: 1, imageUrl: starDesign },
	{ designSeq: 2, imageUrl: vineDesign },
];

type StoredSession = ArSessionDetail & { sessionToken: string };

type Store = Record<string, StoredSession>;

type EventHandler = (event: ArSimulationEvent) => void;

const handlers = new Set<EventHandler>();
/** 세션별 예약 타이머 — 정리하지 않으면 세션을 지운 뒤에도 이벤트가 날아온다 */
const timers = new Map<string, ReturnType<typeof setTimeout>[]>();

function readStore(): Store {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as Store) : {};
	} catch {
		return {};
	}
}

function writeStore(store: Store): void {
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
	} catch {
		// 저장 실패(사파리 프라이빗 등)해도 이번 세션 흐름은 메모리 타이머로 이어진다
	}
}

function randomId(): string {
	return typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID().replace(/-/g, "")
		: Math.random().toString(36).slice(2).padEnd(12, "0");
}

function emit(event: ArSimulationEvent): void {
	for (const handler of handlers) handler(event);
}

function updateSession(
	sessionId: string,
	patch: (session: StoredSession) => StoredSession,
): StoredSession | null {
	const store = readStore();
	const current = store[sessionId];
	if (!current) return null;
	const next = patch(current);
	store[sessionId] = next;
	writeStore(store);
	return next;
}

function schedule(sessionId: string, delayMs: number, run: () => void): void {
	const timer = setTimeout(run, delayMs);
	timers.set(sessionId, [...(timers.get(sessionId) ?? []), timer]);
}

/** 세션에 걸린 예약 이벤트를 모두 취소한다 */
export function cancelMockSession(sessionId: string): void {
	for (const timer of timers.get(sessionId) ?? []) clearTimeout(timer);
	timers.delete(sessionId);
}

export function createMockArSession(): CreateArSessionResponse {
	const sessionId = randomId();
	const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
	const store = readStore();
	store[sessionId] = {
		sessionId,
		status: "CREATED",
		phoneConnected: false,
		expiresAt,
		expiresInSeconds: SESSION_TTL_SECONDS,
		designs: MOCK_DESIGNS,
		composites: [],
		sessionToken: randomId(),
	};
	writeStore(store);

	// 폰이 QR을 찍고 캡처까지 하는 과정을 시간차로 흉내 낸다
	schedule(sessionId, MOCK_CONNECT_DELAY_MS, () => {
		const next = updateSession(sessionId, (session) => ({
			...session,
			status: "CONNECTED",
			phoneConnected: true,
			phoneConnectedDttm: new Date().toISOString(),
		}));
		if (!next) return;
		emit({ eventId: randomId(), sessionId, eventType: "PHONE_CONNECTED" });
	});

	schedule(sessionId, MOCK_CAPTURE_DELAY_MS, () => {
		const composite: ArComposite = {
			compositeSeq: Date.now(),
			imageSeq: Date.now(),
			imageUrl: demoTattoo,
			regDttm: new Date().toISOString(),
		};
		const next = updateSession(sessionId, (session) => ({
			...session,
			composites: [...session.composites, composite],
		}));
		if (!next) return;
		emit({
			eventId: randomId(),
			sessionId,
			eventType: "COMPOSITE_CREATED",
			composite,
		});
	});

	return { sessionId, expiresInSeconds: SESSION_TTL_SECONDS, expiresAt };
}

export function getMockArSession(sessionId: string): ArSessionDetail | null {
	const session = readStore()[sessionId];
	if (!session) return null;
	// sessionToken은 폰에게만 주는 값이라 조회 응답에서는 뺀다
	const remainingMs = Date.parse(session.expiresAt) - Date.now();
	const detail: ArSessionDetail = {
		sessionId: session.sessionId,
		status: session.status,
		phoneConnected: session.phoneConnected,
		phoneConnectedDttm: session.phoneConnectedDttm,
		expiresAt: session.expiresAt,
		expiresInSeconds: Math.max(0, Math.round(remainingMs / 1000)),
		designs: session.designs,
		composites: session.composites,
	};
	// 실제 백엔드도 만료를 410이 아니라 EXPIRED 상태 + 지금까지의 결과로 준다
	if (remainingMs < 0) return { ...detail, status: "EXPIRED" };
	return detail;
}

export function connectMockArSession(
	sessionId: string,
): ConnectArSessionResponse | null {
	const existing = readStore()[sessionId];
	// 실제 백엔드와 같은 상태 코드로 던져야 화면 분기를 목으로도 확인할 수 있다
	if (!existing) throw new ApiError(404, "NOT_FOUND", "세션을 찾을 수 없습니다.");
	// 실제 백엔드는 세션당 최초 1대만 붙는다 (이후 409)
	if (existing.phoneConnected) throw new ApiError(409, "CONFLICT", "이미 다른 기기가 연결되어 있습니다.");
	if (Date.parse(existing.expiresAt) < Date.now()) {
		throw new ApiError(410, "GONE", "세션이 만료되었습니다.");
	}

	const session = updateSession(sessionId, (current) => ({
		...current,
		status: "CONNECTED",
		phoneConnected: true,
		phoneConnectedDttm: new Date().toISOString(),
	}));
	if (!session) return null;
	emit({ eventId: randomId(), sessionId, eventType: "PHONE_CONNECTED" });
	return {
		sessionToken: session.sessionToken,
		expiresInSeconds: Math.max(
			0,
			Math.round((Date.parse(session.expiresAt) - Date.now()) / 1000),
		),
		expiresAt: session.expiresAt,
		designs: session.designs,
	};
}

export function addMockArComposite(
	sessionId: string,
	imageUrl: string,
): ArComposite | null {
	const composite: ArComposite = {
		compositeSeq: Date.now(),
		imageSeq: Date.now(),
		imageUrl,
		regDttm: new Date().toISOString(),
	};
	const session = updateSession(sessionId, (current) => ({
		...current,
		composites: [...current.composites, composite],
	}));
	if (!session) return null;
	emit({
		eventId: randomId(),
		sessionId,
		eventType: "COMPOSITE_CREATED",
		composite,
	});
	return composite;
}

/** 실제 STOMP 구독을 대신한다 — 해제 함수를 돌려준다 */
export function subscribeMockArEvents(handler: EventHandler): () => void {
	handlers.add(handler);
	return () => {
		handlers.delete(handler);
	};
}
