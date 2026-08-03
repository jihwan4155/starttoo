import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchDmRooms } from "../../services/dmApi";
import useAuthStore from "../../store/useAuthStore";

export const dmRoomsQueryKey = ["dm", "rooms"] as const;

type DmRoomsParams = {
	size?: number;
};

/** GET /dm/rooms */
export default function useDmRooms(params?: DmRoomsParams) {
	const accessToken = useAuthStore((s) => s.accessToken);
	const { size = 30 } = params ?? {};

	return useInfiniteQuery({
		queryKey: [...dmRoomsQueryKey, { size }],
		enabled: Boolean(accessToken),
		// 변경이 생기면 무효화로 즉시 갱신된다. 화면을 드나들 때마다 다시 받을 이유는 없다.
		staleTime: 30_000,
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam }) => fetchDmRooms({ size, cursor: pageParam }),
		getNextPageParam: (lastPage) =>
			lastPage.hasNext && lastPage.nextCursor ? lastPage.nextCursor : undefined,
	});
}
