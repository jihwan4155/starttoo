import { api } from "./api";
import type {
	FollowResponse,
	MeResponse,
	ProfileImageRequest,
	ProfileImageResponse,
	PublicProfileResponse,
	RecentSearchItem,
	RecentSearchListResponse,
	RecentSearchRequest,
	UpdateMeRequest,
	UpdateMeResponse,
} from "../types/user";

/** GET /users/me */
export async function fetchMe(): Promise<MeResponse> {
	const { data } = await api.get<MeResponse>("/users/me");
	return data;
}

/** PATCH /users/me */
export async function updateMe(body: UpdateMeRequest): Promise<UpdateMeResponse> {
	const { data } = await api.patch<UpdateMeResponse>("/users/me", body);
	return data;
}

/** PUT /users/me/profile-image */
export async function updateProfileImage(
	body: ProfileImageRequest,
): Promise<ProfileImageResponse> {
	const { data } = await api.put<ProfileImageResponse>(
		"/users/me/profile-image",
		body,
	);
	return data;
}

/** DELETE /users/me/profile-image */
export async function removeProfileImage(): Promise<void> {
	await api.delete("/users/me/profile-image");
}

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
