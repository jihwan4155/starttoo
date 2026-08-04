import { ApiError } from "../services/api";

/**
 * 토글(좋아요·북마크) 요청을 모아 보내는 트레일링 디바운스 큐.
 *
 * 화면은 클릭마다 즉시 바뀌지만(낙관적 업데이트), 서버 요청은 연타가 멈춘 뒤
 * 마지막 상태 하나만 보낸다. 눌렀다 되돌려 서버 상태와 같아졌으면 요청 자체를
 * 생략한다. 좋아요를 연타했을 때 백엔드 레이트 리밋(429)에 걸리는 것을 막는 게
 * 목적이다.
 *
 * key는 대상 하나를 가리키는 문자열(예: "post-like:12"). 같은 key로 다시
 * 예약하면 타이머가 리셋되고, 최초 예약 시점의 base(서버가 아는 상태)는 유지된다.
 */

export const TOGGLE_COMMIT_DELAY = 500;

/** 레이트 리밋(429) — 연타 때문에 나는 것이라 알림창을 띄우지 않는다 */
export function isRateLimited(error: unknown): boolean {
	return error instanceof ApiError && error.status === 429;
}

type PendingCommit = {
	timer: ReturnType<typeof setTimeout>;
	/** 서버가 알고 있는 상태 — 연타 시작 시점의 값 */
	base: boolean;
	/** 사용자가 원하는 최종 상태 */
	desired: boolean;
	commit: (desired: boolean) => void;
};

const pending = new Map<string, PendingCommit>();

function run(key: string) {
	const entry = pending.get(key);
	if (!entry) return;
	clearTimeout(entry.timer);
	pending.delete(key);
	// 눌렀다 되돌려 서버 상태와 같아졌으면 보낼 것이 없다
	if (entry.desired === entry.base) return;
	entry.commit(entry.desired);
}

export function scheduleToggleCommit({
	key,
	base,
	desired,
	commit,
	delay = TOGGLE_COMMIT_DELAY,
}: {
	key: string;
	base: boolean;
	desired: boolean;
	commit: (desired: boolean) => void;
	delay?: number;
}) {
	const current = pending.get(key);
	if (current) clearTimeout(current.timer);
	pending.set(key, {
		base: current?.base ?? base,
		desired,
		commit,
		timer: setTimeout(() => run(key), delay),
	});
}

/**
 * 예약된 요청을 지금 보낸다 (화면 이탈·탭 종료 등으로 타이머를 기다릴 수 없을 때).
 * keyPrefix를 주면 해당 종류만 보낸다.
 */
export function flushToggleCommits(keyPrefix?: string) {
	for (const key of [...pending.keys()]) {
		if (keyPrefix && !key.startsWith(keyPrefix)) continue;
		run(key);
	}
}

// 탭을 닫거나 다른 사이트로 이동할 때 남은 요청을 흘려보낸다(best effort).
if (typeof window !== "undefined") {
	window.addEventListener("pagehide", () => flushToggleCommits());
}
