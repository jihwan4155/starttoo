import { QueryClient } from "@tanstack/react-query";

/**
 * 앱 전역 QueryClient.
 *
 * React 밖(zustand store)에서도 캐시를 비워야 해서 모듈 레벨에 둔다.
 * 계정이 바뀔 때 이전 계정의 응답이 다음 계정 화면에 비치지 않게 하는 용도.
 */
export const queryClient = new QueryClient();
