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
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam }) => fetchDmRooms({ size, cursor: pageParam }),
		getNextPageParam: (lastPage) =>
			lastPage.hasNext && lastPage.nextCursor ? lastPage.nextCursor : undefined,
	});
}
