import { useCallback } from "react";
import type { MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

/** 같은 메뉴를 다시 눌렀다는 표식. MainLayout 이 이 값을 Outlet 의 key 로 쓴다. */
export type NavResetState = { navResetAt?: number };

/**
 * 이미 보고 있는 화면의 메뉴를 다시 누르면 그 화면을 처음 상태로 되돌린다.
 *
 * 라우터는 같은 주소로의 이동을 아무 일도 아닌 것으로 넘겨서, 커뮤니티에서
 * 커뮤니티를 눌러도 화면이 그대로다. 그럴 때만 이동을 가로챈다. 주소가 조금이라도
 * 다르면(예: /posts/search?q=용) 손대지 않고 평소대로 이동시켜, 검색어가 붙은
 * 화면에서 누르면 빈 화면으로 돌아간다.
 *
 * 되돌리는 데는 두 가지가 필요하다.
 *   1. 서버 데이터 — invalidateQueries 로 다시 받는다.
 *   2. 화면이 들고 있는 상태 — 커버업의 업로드한 사진과 추천 결과, 시뮬레이션의
 *      진행 단계처럼 컴포넌트 useState 에 있는 값들이다. 캐시를 지워도 이건 남는다.
 *
 * 예전에는 1번만 해서, 커버업에서 추천까지 받아 놓고 커버업 메뉴를 다시 눌러도
 * 첫 화면으로 돌아가지 않았다. 2번을 위해 같은 주소로 다시 이동하되 location.state
 * 에 표식을 남기고, MainLayout 이 그 값을 Outlet 의 key 로 삼아 화면을 새로 그린다.
 */
export default function useNavRefresh() {
	const { pathname, search } = useLocation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	return useCallback(
		(to: string) => (event: MouseEvent) => {
			const [targetPath, targetQuery = ""] = to.split("?");
			if (targetPath !== pathname) return;
			if (targetQuery !== search.replace(/^\?/, "")) return;

			event.preventDefault();
			window.scrollTo({ top: 0 });
			// 어떤 화면에서 눌릴지 모르니 지금 화면이 쓰는 질의를 통째로 다시 받는다.
			void queryClient.invalidateQueries();
			// replace 라 뒤로가기 기록이 쌓이지 않는다. 값이 매번 달라야 key 가 바뀌므로
			// 시각을 쓴다(같은 밀리초에 두 번 눌리는 경우는 사람 조작에서 나오지 않는다).
			navigate(to, {
				replace: true,
				state: { navResetAt: Date.now() } satisfies NavResetState,
			});
		},
		[pathname, search, navigate, queryClient],
	);
}
