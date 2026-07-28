import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMe } from "../../services/userApi";
import { meQueryKey } from "../queries/useMe";
import type { UpdateMeRequest } from "../../types/user";

/** PATCH /users/me */
export default function useUpdateMe() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (body: UpdateMeRequest) => updateMe(body),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: meQueryKey });
		},
	});
}
