import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeFromArchive } from "../../services/archiveApi";
import { archiveQueryKey } from "../queries/useArchive";

/** DELETE /archive/{tattooId} */
export default function useRemoveFromArchive() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (tattooId: number) => removeFromArchive(tattooId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: archiveQueryKey });
		},
	});
}
