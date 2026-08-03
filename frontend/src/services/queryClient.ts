import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";

/** 서버가 4xx로 거절한 요청은 다시 보내도 결과가 같다 */
function isClientError(error: unknown): boolean {
	return (
		error instanceof ApiError && error.status >= 400 && error.status < 500
	);
}

/**
 * 앱 전역 QueryClient.
 *
 * React 밖(zustand store)에서도 캐시를 비워야 해서 모듈 레벨에 둔다.
 * 계정이 바뀔 때 이전 계정의 응답이 다음 계정 화면에 비치지 않게 하는 용도.
 *
 * 기본 재시도를 손본 이유: 백엔드 레이트 리밋은 읽기 60회/분이라 429가 났을 때
 * 재시도하면 한도를 더 깎아 회복을 늦춘다. 기본값(3회)이면 실패 요청이 4배로
 * 불어나 화면 전체가 "요청이 너무 많습니다"로 막혔다.
 */
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: (failureCount, error) =>
				isClientError(error) ? false : failureCount < 2,
			// 탭을 옮겨 다닐 때마다 모든 쿼리가 다시 나가면 리밋을 쉽게 넘긴다.
			refetchOnWindowFocus: false,
		},
		mutations: {
			retry: false,
		},
	},
});
