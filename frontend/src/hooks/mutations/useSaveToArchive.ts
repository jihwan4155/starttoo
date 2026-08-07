import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveToArchive } from "../../services/archiveApi";
import { archiveQueryKey } from "../queries/useArchive";

/** PUT /archive/{tattooSeq} — 추출 결과를 도안 보관함에 저장 */
export default function useSaveToArchive() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (tattooSeq: number) => saveToArchive(tattooSeq),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: archiveQueryKey });
		},
	});
}
