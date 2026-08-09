import { ApiError } from "../services/api";
import useLoginPromptStore from "../store/useLoginPromptStore";

/** 로그인이 없거나 만료돼서 막힌 요청인지 */
export function isUnauthorized(error: unknown): boolean {
	return error instanceof ApiError && error.status === 401;
}

/**
 * 사용자가 누른 동작이 실패했을 때의 안내.
 *
 * <p>로그인 문제(401)라면 알림창 대신 로그인 안내를 띄운다. "인증이 필요합니다"
 * 같은 문장을 alert로 보여 줘 봐야 사용자가 할 수 있는 일이 없고, 확인을 누르면
 * 그대로 제자리다. 로그인 창까지 이어 주는 편이 다음 행동으로 연결된다.
 *
 * <p>그 밖의 실패는 지금까지처럼 알림창으로 알린다.
 */
export function notifyActionError(error: unknown, fallback: string): void {
	if (isUnauthorized(error)) {
		useLoginPromptStore.getState().openLoginPrompt();
		return;
	}
	window.alert(error instanceof ApiError ? error.message : fallback);
}
