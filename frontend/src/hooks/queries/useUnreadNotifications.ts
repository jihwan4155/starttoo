import { useInfiniteQuery } from "@tanstack/react-query";
import { getUnreadNotifications } from "../../services/notificationApi";
import useAuthStore from "../../store/useAuthStore";

export const unreadNotificationsQueryKey = ["notifications", "unread"] as const;

/** GET /notifications — 미확인 알림 목록 (커서 무한 스크롤) */
export default function useUnreadNotifications(size = 20) {
	const accessToken = useAuthStore((s) => s.accessToken);

	return useInfiniteQuery({
		queryKey: [...unreadNotificationsQueryKey, { size }],
		enabled: Boolean(accessToken),
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam }) =>
			getUnreadNotifications({ cursor: pageParam, size }),
		getNextPageParam: (lastPage) =>
			lastPage.hasNext && lastPage.nextCursor
				? lastPage.nextCursor
				: undefined,
	});
}
