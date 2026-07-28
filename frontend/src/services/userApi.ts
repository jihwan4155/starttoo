import { api } from "./api";
import type {
	FollowResponse,
	PublicProfileResponse,
	RecentSearchItem,
	RecentSearchListResponse,
	RecentSearchRequest,
} from "../types/user";

/** GET /users/{userId} */
export async function fetchUserProfile(
	userId: number,
): Promise<PublicProfileResponse> {
	const { data } = await api.get<PublicProfileResponse>(`/users/${userId}`);
	return data;
}

/** POST /users/{userId}/follow */
export async function followUser(userId: number): Promise<FollowResponse> {
	const { data } = await api.post<FollowResponse>(`/users/${userId}/follow`);
	return data;
}

/** DELETE /users/{userId}/follow */
export async function unfollowUser(userId: number): Promise<FollowResponse> {
	const { data } = await api.delete<FollowResponse>(`/users/${userId}/follow`);
	return data;
}

/** GET /users/me/recent-searches */
export async function fetchRecentSearches(): Promise<RecentSearchListResponse> {
	const { data } = await api.get<RecentSearchListResponse>(
		"/users/me/recent-searches",
	);
	return data;
}

/** POST /users/me/recent-searches */
export async function saveRecentSearch(
	body: RecentSearchRequest,
): Promise<RecentSearchItem> {
	const { data } = await api.post<RecentSearchItem>(
		"/users/me/recent-searches",
		body,
	);
	return data;
}

/** DELETE /users/me/recent-searches/{recentSearchId} */
export async function deleteRecentSearch(recentSearchId: number): Promise<void> {
	await api.delete(`/users/me/recent-searches/${recentSearchId}`);
}

/** DELETE /users/me/recent-searches */
export async function deleteAllRecentSearches(): Promise<void> {
	await api.delete("/users/me/recent-searches");
}
