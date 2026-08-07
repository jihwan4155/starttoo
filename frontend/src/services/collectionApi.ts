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
 * imageSeq는 도안 보관함(GET /archive)의 designImageSeq다.
 * 서버가 기존 타투를 재참조해 배치만 만들며, 같은 도안을 여러 위치에 올릴 수 있다.
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
 * 배치 행만 소프트 삭제한다. 참조 타투·도안 이미지는 유지된다.
 */
export async function deleteCollection(
	collectionSeq: number,
): Promise<boolean> {
	const { data } = await api.delete<boolean>(`/collections/${collectionSeq}`);
	return data;
}
