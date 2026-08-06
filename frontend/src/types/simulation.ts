/**
 * 실시간(AR) 시뮬레이션 세션 — PC와 폰을 잇는 계약.
 *
 * <p>백엔드 구현 전이라 아직 배포 스펙(/v3/api-docs)에 없는 경로들이다.
 * 요청해 둔 스펙에 맞춰 미리 정의하고, 실제 응답이 나오면 여기만 맞춘다.
 *
 * <p>핵심 제약: QR로 들어오는 폰은 <b>비로그인</b>이다(/simulations/ar/:sessionId는
 * RequireAuth 밖). 그래서 폰은 JWT 대신 /connect에서 받은 단기 sessionToken으로
 * 인증하고, 도안 URL도 그 응답으로 받아야 한다.
 */

/** 세션 상태 — 폰 접속 전/후, 만료·종료 */
export type ArSessionStatus = "CREATED" | "CONNECTED" | "CLOSED" | "EXPIRED";

/** 폰 보관함에 띄울 도안 (PC가 세션 생성 시 고른 것) */
export type ArSessionDesign = {
	designSeq: number;
	/** 단기 presigned GET URL */
	imageUrl: string;
};

/** 폰이 캡처해 올린 합성 결과 */
export type ArComposite = {
	compositeSeq: number;
	/** 세션 소유자 명의로 등록된 images 행 */
	imageSeq: number;
	/** 단기 presigned GET URL */
	imageUrl: string;
	/** ISO-8601 */
	regDttm: string;
};

/** POST /v1/simulations/ar-sessions — PC(JWT) */
export type CreateArSessionRequest = {
	/** 폰에서 쓸 도안. 비우면 서버가 기본 도안을 내려준다 */
	designSeqs?: number[];
};

export type CreateArSessionResponse = {
	/** UUID — QR에 그대로 실린다 */
	sessionId: string;
	expiresInSeconds: number;
	/** ISO-8601 */
	expiresAt: string;
};

/**
 * GET /v1/simulations/ar-sessions/{sessionId} — PC(JWT). 새로고침·재접속 복구용.
 *
 * <p>만료돼도 410이 아니라 EXPIRED 상태와 지금까지의 결과를 그대로 준다.
 * 세션 소유자가 아니면 존재 여부를 감추려고 404다.
 */
export type ArSessionDetail = {
	sessionId: string;
	status: ArSessionStatus;
	phoneConnected: boolean;
	/** ISO-8601. 폰이 붙기 전에는 없다 */
	phoneConnectedDttm?: string;
	/** ISO-8601 */
	expiresAt: string;
	expiresInSeconds: number;
	designs: ArSessionDesign[];
	composites: ArComposite[];
};

/** POST /v1/simulations/ar-sessions/{sessionId}/connect — 폰(무인증). 최초 1대만 성공(이후 409) */
export type ConnectArSessionResponse = {
	/** 이 세션의 업로드 API에서만 통하는 단기 토큰 */
	sessionToken: string;
	expiresInSeconds: number;
	/** ISO-8601 */
	expiresAt: string;
	designs: ArSessionDesign[];
};

/**
 * POST /v1/simulations/ar-sessions/{sessionId}/composites — 폰(sessionToken)
 *
 * <p>업로드는 기존 이미지 흐름(presign → MinIO PUT → objectKey 전달)을 재사용하는 쪽으로
 * 요청해 두었다. 백엔드가 multipart 직수신을 택하면 이 타입과 uploadArComposite만 바꾼다.
 */
export type CreateArCompositeRequest = {
	objectKey: string;
};

/** STOMP `/user/queue/simulation-events` 이벤트 (PC 수신) */
export type ArSimulationEventType =
	| "PHONE_CONNECTED"
	| "COMPOSITE_CREATED"
	| "SESSION_CLOSED";

export type ArSimulationEvent = {
	eventId: string;
	sessionId: string;
	eventType: ArSimulationEventType;
	/** COMPOSITE_CREATED가 아니면 null */
	composite?: ArComposite | null;
	/** ISO-8601 */
	occurredDttm?: string;
};
