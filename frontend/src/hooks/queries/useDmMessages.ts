import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchDmMessages } from "../../services/dmApi";
import useAuthStore from "../../store/useAuthStore";

/**
 * 방 목록 키(["dm","rooms"])의 접두사에 걸리지 않도록 별도 공간을 쓴다.
 * invalidateQueries는 접두사 매칭이라 ["dm","rooms",seq,"messages"]로 두면
 * 목록을 무효화할 때마다 열어 본 모든 방의 메시지까지 다시 받는다.
 */
export const dmMessagesQueryKey = (roomSeq: number) =>
	["dm", "messages", roomSeq] as const;

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
		// 새 메시지는 실시간 이벤트가 무효화해 준다.
		staleTime: 30_000,
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam }) =>
			fetchDmMessages(roomSeq as number, { size, cursor: pageParam }),
		getNextPageParam: (lastPage) =>
			lastPage.hasNext && lastPage.nextCursor ? lastPage.nextCursor : undefined,
	});
}
