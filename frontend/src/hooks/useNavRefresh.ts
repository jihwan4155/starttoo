import { useCallback } from "react";
import type { MouseEvent } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

/**
 * 이미 보고 있는 화면의 메뉴를 다시 누르면 그 화면을 새로고침한다.
 *
 * 라우터는 같은 주소로의 이동을 아무 일도 아닌 것으로 넘겨서, 커뮤니티에서
 * 커뮤니티를 눌러도 화면이 그대로다. 그럴 때만 이동을 막고 서버 데이터를 다시
 * 받아 맨 위로 올린다. 주소가 조금이라도 다르면(예: /posts/search?q=용) 손대지
 * 않고 평소대로 이동시켜, 검색어가 붙은 화면에서 누르면 빈 화면으로 돌아간다.
 */
export default function useNavRefresh() {
	const { pathname, search } = useLocation();
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
		},
		[pathname, search, queryClient],
	);
}
