import type {
	ArSessionDetail,
	ArSimulationEvent,
	ConnectArSessionResponse,
	CreateArSessionRequest,
	CreateArSessionResponse,
} from "../types/simulation";
import { api } from "./api";
import { subscribeRealtime } from "./realtimeClient";

/**
 * 실시간(AR) 세션 API — PC가 QR로 세션을 열고, 폰이 붙어 캡처를 올린다.
 *
 * <p>PC는 JWT로, QR로 들어온 비로그인 폰은 /connect에서 받은 sessionToken으로
 * 인증한다. 결과는 PC 개인 큐로 실시간 전달된다.
 */

/** PC가 구독하는 STOMP 목적지 */
export const SIMULATION_EVENTS_DESTINATION = "/user/queue/simulation-events";

const BASE_PATH = "/simulations/ar-sessions";

function isArSimulationEvent(value: unknown): value is ArSimulationEvent {
	if (!value || typeof value !== "object") return false;
	const event = value as Partial<ArSimulationEvent>;
	return (
		typeof event.eventId === "string" &&
		typeof event.sessionId === "string" &&
		(event.eventType === "PHONE_CONNECTED" ||
			event.eventType === "COMPOSITE_CREATED" ||
			event.eventType === "SESSION_CLOSED")
	);
}

/** 세션 생성 — PC(JWT). QR에 실을 sessionId를 받는다 */
export async function createArSession(
	body: CreateArSessionRequest = {},
): Promise<CreateArSessionResponse> {
	const { data } = await api.post<CreateArSessionResponse>(BASE_PATH, body);
	return data;
}

/**
 * 세션 상태 조회 — PC(JWT). 새로고침 복구용.
 *
 * <p>만료돼도 410이 아니라 EXPIRED 상태와 지금까지의 결과가 온다.
 * 소유자가 아니면 존재를 감추려고 404다.
 */
export async function getArSession(
	sessionId: string,
): Promise<ArSessionDetail> {
	const { data } = await api.get<ArSessionDetail>(`${BASE_PATH}/${sessionId}`);
	return data;
}

/** 세션 종료 — PC. sessionToken이 즉시 무효가 되어 폰의 후속 업로드가 막힌다 */
export async function closeArSession(sessionId: string): Promise<void> {
	await api.delete(`${BASE_PATH}/${sessionId}`);
}

/** 폰 접속 — 무인증. sessionToken과 도안 URL을 받는다. 최초 1대만 성공(이후 409) */
export async function connectArSession(
	sessionId: string,
): Promise<ConnectArSessionResponse> {
	const { data } = await api.post<ConnectArSessionResponse>(
		`${BASE_PATH}/${sessionId}/connect`,
		{},
	);
	return data;
}

/**
 * 캡처 결과 업로드 — 폰(sessionToken).
 *
 * <p>presign → MinIO PUT → objectKey 전달 흐름을 쓴다(uploadApi.uploadImage와 동일한 모양).
 * 폰은 JWT가 없어 공통 api 인스턴스의 Authorization 대신 세션 토큰을 직접 싣는다.
 */
export async function uploadArComposite(
	sessionId: string,
	sessionToken: string,
	image: Blob,
): Promise<void> {
	const headers = { Authorization: `Session ${sessionToken}` };
	const { data: presigned } = await api.post<{
		objectKey: string;
		uploadUrl: string;
		requiredHeaders?: Record<string, string>;
	}>(
		`${BASE_PATH}/${sessionId}/composites/presign`,
		{
			contentType: image.type || "image/png",
			fileSize: image.size,
			originalFilename: "ar-composite.png",
		},
		{ headers },
	);

	const uploaded = await fetch(presigned.uploadUrl, {
		method: "PUT",
		headers: {
			...(presigned.requiredHeaders ?? {}),
			"Content-Type": image.type || "image/png",
		},
		body: image,
	});
	if (!uploaded.ok) throw new Error("캡처 이미지 업로드에 실패했습니다.");

	await api.post(
		`${BASE_PATH}/${sessionId}/composites`,
		{ objectKey: presigned.objectKey },
		{ headers },
	);
}

/**
 * PC가 세션 이벤트를 받는다 — 해제 함수를 돌려준다.
 *
 * <p>소켓 대신 폴링으로 가야 하면 이 함수만 getArSession 폴링으로 바꾼다.
 */
export function subscribeArSessionEvents(
	handler: (event: ArSimulationEvent) => void,
): () => void {
	return subscribeRealtime(SIMULATION_EVENTS_DESTINATION, (payload) => {
		if (!isArSimulationEvent(payload)) return;
		handler(payload);
	});
}
