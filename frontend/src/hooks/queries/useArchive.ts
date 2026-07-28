import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchArchive } from "../../services/archiveApi";
import useAuthStore from "../../store/useAuthStore";
import type { FetchArchiveParams } from "../../types/archive";

export const archiveQueryKey = ["archive"] as const;

type ArchiveParams = Omit<FetchArchiveParams, "cursor">;

/** GET /archive */
export default function useArchive(params?: ArchiveParams) {
	const accessToken = useAuthStore((s) => s.accessToken);
	const { size = 30 } = params ?? {};

	return useInfiniteQuery({
		queryKey: [...archiveQueryKey, { size }],
		enabled: Boolean(accessToken),
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam }) =>
			fetchArchive({ size, cursor: pageParam }),
		getNextPageParam: (lastPage) =>
			lastPage.hasNext && lastPage.nextCursor
				? lastPage.nextCursor
				: undefined,
	});
}
