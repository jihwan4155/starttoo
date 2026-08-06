import {
	addMockArComposite,
	cancelMockSession,
	connectMockArSession,
	createMockArSession,
	getMockArSession,
	subscribeMockArEvents,
} from "../mocks/simulation";
import type {
	ArSessionDetail,
	ArSimulationEvent,
	ConnectArSessionResponse,
	CreateArSessionRequest,
	CreateArSessionResponse,
} from "../types/simulation";
import { ApiError, api } from "./api";
import { subscribeRealtime } from "./realtimeClient";

/**
 * 실시간(AR) 세션 API.
 *
 * <p>백엔드가 배포돼 기본값은 실제 API다. 백엔드 없이 PC 화면만 보려면
 * `.env.local`에 `VITE_AR_SESSION_MOCK=true`를 넣는다 — 폰이 붙어서 캡처를
 * 올리는 과정을 타이머로 흉내 낸다(한 기기 안에서만 유효).
 */
export const USE_AR_SESSION_MOCK =
	import.meta.env.VITE_AR_SESSION_MOCK === "true";

/** PC가 구독하는 STOMP 목적지 (백엔드에 추가 요청해 둔 경로) */
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
	if (USE_AR_SESSION_MOCK) return createMockArSession();
	const { data } = await api.post<CreateArSessionResponse>(BASE_PATH, body);
	return data;
}

/** 세션 상태 조회 — PC(JWT). 새로고침 복구·폴링 대안 */
export async function getArSession(
	sessionId: string,
): Promise<ArSessionDetail> {
	if (USE_AR_SESSION_MOCK) {
		const session = getMockArSession(sessionId);
		// 백엔드는 소유자가 아니거나 없는 세션을 똑같이 404로 감춘다
		if (!session) throw new ApiError(404, "NOT_FOUND", "세션을 찾을 수 없습니다.");
		return session;
	}
	const { data } = await api.get<ArSessionDetail>(`${BASE_PATH}/${sessionId}`);
	return data;
}

/** 세션 종료 — PC. 목에서는 예약된 이벤트 타이머만 정리한다 */
export async function closeArSession(sessionId: string): Promise<void> {
	if (USE_AR_SESSION_MOCK) {
		cancelMockSession(sessionId);
		return;
	}
	await api.delete(`${BASE_PATH}/${sessionId}`);
}

/** 폰 접속 — 무인증. sessionToken과 도안 URL을 받는다 */
export async function connectArSession(
	sessionId: string,
): Promise<ConnectArSessionResponse> {
	if (USE_AR_SESSION_MOCK) {
		const connected = connectMockArSession(sessionId);
		if (!connected) throw new ApiError(404, "NOT_FOUND", "세션을 찾을 수 없습니다.");
		return connected;
	}
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
	if (USE_AR_SESSION_MOCK) {
		addMockArComposite(sessionId, URL.createObjectURL(image));
		return;
	}

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
 * <p>백엔드가 소켓 대신 폴링으로 가기로 하면 이 함수만 getArSession 폴링으로 바꾼다.
 */
export function subscribeArSessionEvents(
	handler: (event: ArSimulationEvent) => void,
): () => void {
	if (USE_AR_SESSION_MOCK) return subscribeMockArEvents(handler);
	return subscribeRealtime(SIMULATION_EVENTS_DESTINATION, (payload) => {
		if (!isArSimulationEvent(payload)) return;
		handler(payload);
	});
}
