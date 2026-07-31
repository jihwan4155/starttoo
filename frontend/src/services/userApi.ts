import { api } from "./api";
import type {
	BeMyProfile,
	BeProfileImageRequest,
	BePublicProfile,
	BeRecentSearchUpdateRequest,
	BeRelationState,
	BeUpdateProfileRequest,
} from "../types/beUser";
import type {
	FollowResponse,
	MeResponse,
	PublicProfileResponse,
	UpdateMeRequest,
} from "../types/user";
import { mapMyProfile, mapPublicProfile } from "../utils/mapUser";

/** GET /users/me */
export async function fetchMe(): Promise<MeResponse> {
	const { data } = await api.get<BeMyProfile>("/users/me");
	return mapMyProfile(data);
}

/** PATCH /users/me */
export async function updateMe(body: UpdateMeRequest): Promise<MeResponse> {
	const payload: BeUpdateProfileRequest = {};

	if (body.nickname != null) payload.nickname = body.nickname;
	if (body.removeBirthDate) {
		payload.birthDate = null;
	} else if (body.birthDate != null) {
		payload.birthDate = body.birthDate;
	}
	if (body.removeGender) {
		payload.gender = null;
	} else if (body.gender != null) {
		payload.gender = body.gender;
	}

	const { data } = await api.patch<BeMyProfile>("/users/me", payload);
	return mapMyProfile(data);
}

/** PATCH /users/me/profile-image */
export async function updateProfileImage(
	body: BeProfileImageRequest,
): Promise<MeResponse> {
	const { data } = await api.patch<BeMyProfile>(
		"/users/me/profile-image",
		body,
	);
	return mapMyProfile(data);
}

/** GET /users/{userSeq} */
export async function fetchUserProfile(
	userId: number,
	viewerUserId?: number | null,
): Promise<PublicProfileResponse> {
	const { data } = await api.get<BePublicProfile>(`/users/${userId}`);
	return mapPublicProfile(data, viewerUserId);
}

/** PUT /users/{userSeq}/follow */
export async function followUser(userId: number): Promise<FollowResponse> {
	const { data } = await api.put<BeRelationState>(`/users/${userId}/follow`);
	return {
		userId,
		following: data.enabled,
		followerCount: 0,
	};
}

/** DELETE /users/{userSeq}/follow */
export async function unfollowUser(userId: number): Promise<FollowResponse> {
	const { data } = await api.delete<BeRelationState>(`/users/${userId}/follow`);
	return {
		userId,
		following: data.enabled,
		followerCount: 0,
	};
}

/** GET /users/me/recent-searches */
export async function fetchRecentSearches(): Promise<string[]> {
	const { data } = await api.get<string[]>("/users/me/recent-searches");
	return data;
}

/** PATCH /users/me/recent-searches — ADD */
export async function saveRecentSearch(keyword: string): Promise<string[]> {
	const body: BeRecentSearchUpdateRequest = {
		operation: "ADD",
		term: keyword,
	};
	const { data } = await api.patch<string[]>("/users/me/recent-searches", body);
	return data;
}

/** PATCH /users/me/recent-searches — REMOVE */
export async function deleteRecentSearch(keyword: string): Promise<string[]> {
	const body: BeRecentSearchUpdateRequest = {
		operation: "REMOVE",
		term: keyword,
	};
	const { data } = await api.patch<string[]>("/users/me/recent-searches", body);
	return data;
}
