import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateArtistMe } from "../../services/artistApi";
import { artistProfileByUserQueryKey } from "../queries/useArtistProfile";
import { artistsQueryKey } from "../queries/useArtists";
import { meQueryKey } from "../queries/useMe";
import { myArtistProfileQueryKey } from "../queries/useMyArtistProfile";
import { userProfileQueryKey } from "../queries/useUserProfile";
import type { UpdateArtistRequest } from "../../types/artist";

/** PATCH /artists/me/profile */
export default function useUpdateArtist() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (body: UpdateArtistRequest) => updateArtistMe(body),
		onSuccess: (data) => {
			// 응답이 곧 최신 숍 프로필이라 마이페이지·공개 프로필 조회 캐시를 바로 갈아 끼운다.
			queryClient.setQueryData(myArtistProfileQueryKey, data);
			queryClient.setQueryData(artistProfileByUserQueryKey(data.userId), data);
			void queryClient.invalidateQueries({ queryKey: meQueryKey });
			void queryClient.invalidateQueries({ queryKey: artistsQueryKey });
			void queryClient.invalidateQueries({
				queryKey: userProfileQueryKey(data.userId),
			});
		},
	});
}
