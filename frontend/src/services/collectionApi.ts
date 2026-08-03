import { api } from "./api";
import type { CursorPage } from "../types/community";
import type { CollectionResponse } from "../types/collection";

type CollectionPageQuery = {
	cursor?: number;
	size?: number;
};

/** GET /users/{userSeq}/collections — 특정 회원의 컬렉션 배치 */
export async function fetchUserCollections(
	userSeq: number,
	params?: CollectionPageQuery,
): Promise<CursorPage<CollectionResponse>> {
	const { data } = await api.get<CursorPage<CollectionResponse>>(
		`/users/${userSeq}/collections`,
		{ params },
	);
	return data;
}

/** GET /collections — 내 컬렉션 배치 */
export async function fetchMyCollections(
	params?: CollectionPageQuery,
): Promise<CursorPage<CollectionResponse>> {
	const { data } = await api.get<CursorPage<CollectionResponse>>(
		"/collections",
		{ params },
	);
	return data;
}
