import { api } from "./api";
import type { CursorPage } from "../types/community";
import type {
	ArtistItem,
	ArtistProfileResponse,
	FetchArtistsParams,
	UpdateArtistRequest,
} from "../types/artist";
import type { BeArtistProfile } from "../types/beUser";
import { mapArtistProfile } from "../utils/mapUser";

/** GET /artists — 타투이스트 검색·목록 */
export async function fetchArtists(
	params?: FetchArtistsParams,
): Promise<CursorPage<ArtistItem>> {
	const { data } = await api.get<CursorPage<ArtistItem>>("/artists", {
		params,
	});
	return data;
}

/**
 * PATCH /artists/me/profile — 숍 프로필 수정 후 갱신된 프로필을 돌려받는다
 *
 * users.role=ARTIST이고 artists 확장 행이 있는 계정만 통과한다 (그 외 403).
 * 즉 이 API로 아티스트 프로필을 새로 만들 수는 없다.
 *
 * 주의 — 이름만 PATCH이고 실제로는 전체 덮어쓰기다. 서버가 받은 값을 그대로
 * 대입하므로 본문에서 뺀 필드는 유지되지 않고 NULL이 된다. 다섯 필드를 항상
 * 함께 실어 보내야 한다 (buildArtistShopPatch 참고).
 */
export async function updateArtistMe(
	body: UpdateArtistRequest,
): Promise<ArtistProfileResponse> {
	const { data } = await api.patch<BeArtistProfile>(
		"/artists/me/profile",
		body,
	);
	return mapArtistProfile(data);
}

/** 목록에서 찾을 때까지 훑을 최대 페이지 수 — 요청이 무한정 늘지 않게 한다 */
const ARTIST_PROFILE_LOOKUP_MAX_PAGES = 20;
const ARTIST_PROFILE_LOOKUP_PAGE_SIZE = 50;

/**
 * 유저별 숍 프로필 조회 — GET /artists 목록에서 userSeq로 찾는다.
 *
 * 전용 단건 조회 API가 없어 공개 목록을 훑는다. 목록은 VERIFIED만 담으므로
 * 인증 전에는 null이 돌아온다.
 */
export async function fetchArtistProfileByUserId(
	userId: number,
): Promise<ArtistProfileResponse | null> {
	let cursor: string | undefined;

	for (let page = 0; page < ARTIST_PROFILE_LOOKUP_MAX_PAGES; page += 1) {
		const { data } = await api.get<CursorPage<BeArtistProfile>>("/artists", {
			params: { size: ARTIST_PROFILE_LOOKUP_PAGE_SIZE, cursor },
		});
		const found = (data.items ?? []).find((item) => item.userSeq === userId);
		if (found) return mapArtistProfile(found);
		if (!data.hasNext || !data.nextCursor) return null;
		cursor = data.nextCursor;
	}

	return null;
}

/**
 * 내 숍 프로필 조회 — fetchArtistProfileByUserId에 위임한다.
 */
export async function fetchMyArtistProfile(
	userId: number,
): Promise<ArtistProfileResponse | null> {
	return fetchArtistProfileByUserId(userId);
}

/**
 * 온보딩의 "타투이스트로 시작" — 숍 정보만 실어 위 API를 호출한다.
 *
 * ARTIST로 가입한 계정만 이 단계에 오므로 role 조건은 통과한다. 매장 정보가
 * 선택 입력이라 실패해도 온보딩을 막지 않는다.
 */
export async function upsertArtistProfile(
	body: UpdateArtistRequest,
): Promise<void> {
	await updateArtistMe(body);
}

/**
 * POST /artists/me/verification — 아티스트 인증 처리
 *
 * role=ARTIST이고 아직 VERIFIED가 아닌 계정이 자신의 인증 상태를 VERIFIED로
 * 바꾼다. 원래는 운영팀 승인이 필요하지만 현재 서버는 승인 단계를 생략하고
 * 호출 즉시 인증을 끝낸다.
 *
 * USER면 403, artists 행이 없으면 404, 이미 VERIFIED면 409가 온다.
 */
export async function verifyArtistMe(): Promise<ArtistProfileResponse> {
	const { data } = await api.post<BeArtistProfile>("/artists/me/verification");
	return mapArtistProfile(data);
}
