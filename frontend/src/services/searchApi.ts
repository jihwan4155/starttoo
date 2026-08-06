import { api } from "./api";
import type {
	AccountResult,
	PostSearchResponse,
	SubjectResult,
} from "../types/search";

/**
 * GET /search/accounts — 회원 닉네임 검색 (한 글자부터)
 *
 * 예전에는 두 글자 이상만 받아서 한 글자일 때 /search/accounts/autocomplete 로
 * 갈아 끼웠다. 서버가 한 글자를 받게 되면서(BE a8a2020) 그 우회가 없어졌다.
 * 엔드포인트는 아직 서버에 남아 있지만 화면에서 쓸 이유가 없다.
 */
export async function searchAccounts(
	q: string,
	size = 20,
): Promise<AccountResult[]> {
	const { data } = await api.get<AccountResult[]>("/search/accounts", {
		params: { q, size },
	});
	return data;
}

/**
 * GET /search/artists — 인증 아티스트 닉네임 검색 (한 글자부터)
 *
 * role=ARTIST이고 verificationStatus=VERIFIED인 회원만 인덱싱된다.
 */
export async function searchArtists(
	q: string,
	size = 20,
): Promise<AccountResult[]> {
	const { data } = await api.get<AccountResult[]>("/search/artists", {
		params: { q, size },
	});
	return data;
}

/** GET /search/subjects/autocomplete — 이미지 subject 자동완성 (1글자부터) */
export async function autocompleteSubjects(
	q: string,
	size = 10,
): Promise<SubjectResult[]> {
	const { data } = await api.get<SubjectResult[]>(
		"/search/subjects/autocomplete",
		{ params: { q, size } },
	);
	return data;
}

/**
 * GET /search/posts — subject 기반 게시물 검색 (두 글자 이상)
 *
 * 오타가 있으면 서버가 가장 가까운 subject로 보정해 matchedSubject로 알려 준다.
 * 커서는 postSeq 내림차순이다.
 */
export async function searchPosts(params: {
	q: string;
	cursor?: number | null;
	size?: number;
}): Promise<PostSearchResponse> {
	const { data } = await api.get<PostSearchResponse>("/search/posts", {
		params: {
			q: params.q,
			cursor: params.cursor ?? undefined,
			size: params.size ?? 20,
		},
	});
	return data;
}
