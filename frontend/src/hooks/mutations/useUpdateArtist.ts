import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateArtistMe } from "../../services/artistApi";
import { artistsQueryKey } from "../queries/useArtists";
import { meQueryKey } from "../queries/useMe";
import { userProfileQueryKey } from "../queries/useUserProfile";
import type { UpdateArtistRequest } from "../../types/artist";

/** PATCH /artists/me/profile */
export default function useUpdateArtist() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (body: UpdateArtistRequest) => updateArtistMe(body),
		onSuccess: (data) => {
			void queryClient.invalidateQueries({ queryKey: meQueryKey });
			void queryClient.invalidateQueries({ queryKey: artistsQueryKey });
			void queryClient.invalidateQueries({
				queryKey: userProfileQueryKey(data.userId),
			});
		},
	});
}
