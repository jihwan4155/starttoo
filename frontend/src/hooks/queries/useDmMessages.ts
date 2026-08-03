import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchDmMessages } from "../../services/dmApi";
import useAuthStore from "../../store/useAuthStore";

export const dmMessagesQueryKey = (roomSeq: number) =>
	["dm", "rooms", roomSeq, "messages"] as const;

type DmMessagesParams = {
	size?: number;
};

/**
 * GET /dm/rooms/{roomSeq}/messages
 *
 * 서버가 최신부터 내려주므로 페이지를 넘길수록 과거로 간다. 화면에 그릴 때는
 * 평탄화한 뒤 뒤집어 시간순으로 만든다.
 */
export default function useDmMessages(
	roomSeq: number | null,
	params?: DmMessagesParams,
) {
	const accessToken = useAuthStore((s) => s.accessToken);
	const { size = 50 } = params ?? {};

	return useInfiniteQuery({
		queryKey: dmMessagesQueryKey(roomSeq ?? 0),
		enabled: Boolean(accessToken) && roomSeq != null,
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam }) =>
			fetchDmMessages(roomSeq as number, { size, cursor: pageParam }),
		getNextPageParam: (lastPage) =>
			lastPage.hasNext && lastPage.nextCursor ? lastPage.nextCursor : undefined,
	});
}
