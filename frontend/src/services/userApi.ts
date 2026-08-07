import { api } from "./api";
import type { CursorPage } from "../types/community";
import type {
	BeMyProfile,
	BeProfileImageRequest,
	BePublicProfile,
	BeRecentSearchUpdateRequest,
	BeRelationState,
	BeRelationUser,
	BeUpdateProfileRequest,
} from "../types/beUser";
import type {
	BlockResponse,
	FollowResponse,
	MeResponse,
	PublicProfileResponse,
	RelationUser,
	UpdateMeRequest,
} from "../types/user";
import {
	mapMyProfile,
	mapPublicProfile,
	mapRelationUser,
} from "../utils/mapUser";

/** GET /users/me */
export async function fetchMe(): Promise<MeResponse> {
	const { data } = await api.get<BeMyProfile>("/users/me");
	return mapMyProfile(data);
}

/**
 * PATCH /users/me
 *
 * nickname은 서버 필수라 호출자가 항상 현재 값을 넣어 준다.
 * birthDate·gender는 키를 빼면 유지, null이면 해제다.
 */
export async function updateMe(body: UpdateMeRequest): Promise<MeResponse> {
	const payload: BeUpdateProfileRequest = { nickname: body.nickname };
	if ("birthDate" in body) payload.birthDate = body.birthDate ?? null;
	if ("gender" in body) payload.gender = body.gender ?? null;

	const { data } = await api.patch<BeMyProfile>("/users/me", payload);
	return mapMyProfile(data);
}

/**
 * DELETE /users/me — 회원 탈퇴
 *
 * 서버는 계정 상태를 WITHDRAWN으로 바꾸고 Refresh Token과 푸시 기기를 모두 정리한다.
 * 이 호출이 성공한 시점에 보유 토큰은 이미 무효라, 호출자는 곧바로 로컬 세션을
 * 비워야 한다(서버 로그아웃을 다시 호출할 필요 없다).
 */
export async function withdrawMe(): Promise<void> {
	await api.delete("/users/me");
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
	return { userId, following: data.enabled };
}

/** DELETE /users/{userSeq}/follow */
export async function unfollowUser(userId: number): Promise<FollowResponse> {
	const { data } = await api.delete<BeRelationState>(`/users/${userId}/follow`);
	return { userId, following: data.enabled };
}

/**
 * PUT /users/{userSeq}/block — 회원 차단
 *
 * 차단하면 서버가 양방향 팔로우를 함께 끊고, 이후 그 회원의 프로필·팔로우 목록은
 * USER_NOT_FOUND, DM 방 입장·전송은 FORBIDDEN이 된다. 즉 차단한 뒤에는 상대
 * 화면으로 되돌아갈 수 없으므로 호출부에서 화면을 정리해야 한다.
 */
export async function blockUser(userId: number): Promise<BlockResponse> {
	const { data } = await api.put<BeRelationState>(`/users/${userId}/block`);
	return { userId, blocked: data.enabled };
}

/** DELETE /users/{userSeq}/block — 차단 해제 (끊긴 팔로우는 복구되지 않는다) */
export async function unblockUser(userId: number): Promise<BlockResponse> {
	const { data } = await api.delete<BeRelationState>(`/users/${userId}/block`);
	return { userId, blocked: data.enabled };
}

export type FollowListParams = {
	cursor?: string;
	/** 서버 최대 50 */
	size?: number;
};

async function fetchRelationPage(
	path: string,
	params: FollowListParams,
): Promise<CursorPage<RelationUser>> {
	const { data } = await api.get<CursorPage<BeRelationUser>>(path, { params });
	return { ...data, items: (data.items ?? []).map(mapRelationUser) };
}

/** GET /users/{userSeq}/followers — 이 회원을 팔로우하는 사람 목록 */
export async function fetchFollowers(
	userId: number,
	params: FollowListParams = {},
): Promise<CursorPage<RelationUser>> {
	return fetchRelationPage(`/users/${userId}/followers`, params);
}

/** GET /users/{userSeq}/following — 이 회원이 팔로우하는 사람 목록 */
export async function fetchFollowing(
	userId: number,
	params: FollowListParams = {},
): Promise<CursorPage<RelationUser>> {
	return fetchRelationPage(`/users/${userId}/following`, params);
}

/**
 * GET /users/me/blocks — 내가 차단한 회원 목록
 *
 * 차단하면 상대 프로필로 다시 들어갈 수 없어 그쪽에서는 해제할 방법이 없다.
 * 해제는 이 목록에서만 할 수 있다.
 */
export async function fetchBlockedUsers(
	params: FollowListParams = {},
): Promise<CursorPage<RelationUser>> {
	return fetchRelationPage("/users/me/blocks", params);
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
