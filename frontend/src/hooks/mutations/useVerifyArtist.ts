import { useMutation, useQueryClient } from "@tanstack/react-query";
import { verifyArtistMe } from "../../services/artistApi";
import { meQueryKey } from "../queries/useMe";

/**
 * POST /artists/me/verification — 내 아티스트 인증을 끝낸다.
 *
 * 성공하면 GET /users/me의 verificationStatus가 VERIFIED로 바뀌므로 그 쿼리를
 * 무효화한다. 뱃지 표시와 신청 버튼 노출이 모두 그 값을 보고 갈리기 때문이다.
 */
export default function useVerifyArtist() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: verifyArtistMe,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: meQueryKey });
		},
	});
}
