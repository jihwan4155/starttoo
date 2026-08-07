import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveToArchive } from "../../services/archiveApi";
import { archiveQueryKey } from "../queries/useArchive";

/** PUT /archive/{tattooSeq} — 추출 결과를 도안 보관함에 저장 */
export default function useSaveToArchive() {
	const queryClient = useQueryClient();

	return useMutation({
		/*
		 * 무효화를 onSuccess가 아니라 mutationFn 안에서 한다.
		 *
		 * onSuccess는 이 훅을 쓰는 컴포넌트의 옵저버가 붙어 있을 때만 실행된다. 저장을
		 * 누르고 바로 모달(=게시물 상세)을 닫으면 요청은 서버에 그대로 닿는데 옵저버가
		 * 사라져 콜백이 실행되지 않는다. 그러면 이미 떠 있는 도안 보관함 쿼리가 옛 목록을
		 * 그대로 들고 있고(refetchOnWindowFocus도 꺼져 있다) "저장했는데 보관함에 없다"가
		 * 된다. mutationFn 안이면 뮤테이션 프로미스의 일부라 언마운트와 무관하게 돈다.
		 */
		mutationFn: async (tattooSeq: number) => {
			const result = await saveToArchive(tattooSeq);
			// 재조회가 끝날 때까지 기다리지 않는다 — 저장 버튼이 목록 갱신만큼 늦게 풀린다.
			void queryClient.invalidateQueries({ queryKey: archiveQueryKey });
			return result;
		},
	});
}
