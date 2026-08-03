import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import { API_BASE_URL } from "./api";

/**
 * STOMP over WebSocket 클라이언트 (백엔드 `/ws`)
 *
 * - CONNECT에 `Authorization: Bearer <accessToken>` 네이티브 헤더가 필요하다.
 * - 구독 허용 경로는 `/user/queue/dm-events`, `/user/queue/notifications` 둘뿐이고
 *   클라이언트 SEND는 서버가 거부한다 (메시지 저장은 REST 단일 진입점).
 * - 끊긴 사이의 이벤트는 재연결 후 REST 재조회로 메꾼다.
 */

export const DM_EVENTS_DESTINATION = "/user/queue/dm-events";
export const NOTIFICATIONS_DESTINATION = "/user/queue/notifications";

/**
 * `/ws` 절대 URL.
 *
 * API_BASE_URL은 dev에서 `/v1`(vite 프록시)이고 배포에서는 절대 URL이다.
 * WebSocket은 ws·wss 스킴이 필요해 현재 origin을 기준으로 조립한다.
 * dev에서 https(5173)로 열면 wss가 되고 vite 프록시가 백엔드로 넘긴다.
 */
function resolveWebSocketUrl(): string {
	const base = API_BASE_URL.startsWith("http")
		? new URL(API_BASE_URL)
		: new URL(API_BASE_URL, window.location.origin);
	const protocol = base.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${base.host}/ws`;
}

type RealtimeHandler = (payload: unknown) => void;

let client: Client | null = null;
let currentToken: string | null = null;
/** 목적지별 구독자 — 연결이 살아 있는 동안 재사용한다 */
const handlers = new Map<string, Set<RealtimeHandler>>();
const subscriptions = new Map<string, StompSubscription>();

function dispatch(destination: string, message: IMessage) {
	const listeners = handlers.get(destination);
	if (!listeners?.size) return;
	let payload: unknown;
	try {
		payload = JSON.parse(message.body);
	} catch {
		// 서버가 JSON만 보내므로 파싱 실패는 무시한다 (다음 REST 조회로 복구).
		return;
	}
	for (const listener of listeners) listener(payload);
}

function subscribeDestination(destination: string) {
	if (!client?.connected || subscriptions.has(destination)) return;
	subscriptions.set(
		destination,
		client.subscribe(destination, (message) =>
			dispatch(destination, message),
		),
	);
}

function resubscribeAll() {
	subscriptions.clear();
	for (const destination of handlers.keys()) {
		subscribeDestination(destination);
	}
}

/** 토큰으로 연결을 보장한다. 토큰이 바뀌면 재연결한다. */
export function connectRealtime(accessToken: string): void {
	if (client && currentToken === accessToken) return;
	if (client) disconnectRealtime();

	currentToken = accessToken;
	client = new Client({
		brokerURL: resolveWebSocketUrl(),
		connectHeaders: { Authorization: `Bearer ${accessToken}` },
		reconnectDelay: 5_000,
		heartbeatIncoming: 10_000,
		heartbeatOutgoing: 10_000,
		onConnect: resubscribeAll,
		// 인증 실패·구독 거부는 서버가 ERROR 프레임으로 알려준다. 재연결은 라이브러리가 맡는다.
		onStompError: () => subscriptions.clear(),
		onWebSocketClose: () => subscriptions.clear(),
	});
	client.activate();
}

export function disconnectRealtime(): void {
	subscriptions.clear();
	currentToken = null;
	const previous = client;
	client = null;
	void previous?.deactivate();
}

/**
 * 목적지 구독 — 해제 함수를 돌려준다.
 *
 * 아직 연결 전이면 핸들러만 등록해 두고 onConnect에서 실제 구독이 걸린다.
 */
export function subscribeRealtime(
	destination: string,
	handler: RealtimeHandler,
): () => void {
	const listeners = handlers.get(destination) ?? new Set<RealtimeHandler>();
	listeners.add(handler);
	handlers.set(destination, listeners);
	subscribeDestination(destination);

	return () => {
		listeners.delete(handler);
		if (listeners.size > 0) return;
		handlers.delete(destination);
		subscriptions.get(destination)?.unsubscribe();
		subscriptions.delete(destination);
	};
}
