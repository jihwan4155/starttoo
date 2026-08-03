import { api } from "./api";
import type { CursorPage } from "../types/community";
import type {
	CollectionResponse,
	CreateCollectionRequest,
} from "../types/collection";

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

/**
 * POST /collections — 배치 1건 저장
 *
 * imageSeq는 내가 올린 이미지여야 하고, 아직 타투로 등록되지 않은 것이어야 한다
 * (등록된 이미지는 409 DUPLICATE_RESOURCE). 서버가 이 이미지로 USER_COLLECTION
 * 타투를 만들어 배치에 붙이므로, 같은 이미지를 두 번 배치할 수는 없다.
 */
export async function createCollection(
	body: CreateCollectionRequest,
): Promise<CollectionResponse> {
	const { data } = await api.post<CollectionResponse>("/collections", body);
	return data;
}

/**
 * DELETE /collections/{collectionSeq} — 배치 삭제
 *
 * 배치와 함께 그 배치용으로 만들어진 USER_COLLECTION 타투도 소프트 삭제된다.
 */
export async function deleteCollection(
	collectionSeq: number,
): Promise<boolean> {
	const { data } = await api.delete<boolean>(`/collections/${collectionSeq}`);
	return data;
}
