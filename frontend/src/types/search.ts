import type { PostResponse } from "./community";

/**
 * Swagger SearchDtos.AccountResult
 *
 * userSeq·nickname·role만 내려온다 — 프로필 이미지가 없어서 화면에서는
 * resolveAvatar(null, nickname)로 닉네임 기반 기본 아바타를 쓴다.
 */
export type AccountResult = {
	userSeq: number;
	nickname: string;
	role: string;
	profileImageSeq: number | null;
	/** 단기 Presigned GET URL */
	profileImageUrl: string | null;
	/** role=ARTIST이고 인증까지 끝난 계정인지 — 뱃지 판정은 이 값만 본다 */
	verified: boolean;
};

/** Swagger SearchDtos.SubjectResult */
export type SubjectResult = {
	subjectSeq: number;
	subjectName: string;
};

/** Redis 검색이 어느 단계에서 맞췄는지 */
export type SearchMatchType =
	| "EXACT"
	| "PREFIX"
	| "FUZZY_1"
	| "FUZZY_2"
	| "CONTAINS";

/** Swagger SearchDtos.PostSearchResponse */
export type PostSearchResponse = {
	query: string;
	/** 오타가 보정된 실제 subject — 입력과 다를 수 있다 */
	matchedSubject: SubjectResult | null;
	matchType: SearchMatchType | null;
	items: PostResponse[];
	nextCursor: string | null;
	hasNext: boolean;
	size: number;
};

/**
 * 검색어에 쓸 수 있는 문자 — 서버 @Pattern과 동일.
 *
 * 한글 완성형·자모, 영문, 숫자만 통과한다. 공백·특수문자가 섞이면 서버가 400을
 * 주므로, 요청을 보내기 전에 걸러 불필요한 실패를 만들지 않는다.
 */
const SEARCH_QUERY_PATTERN = /^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]+$/;

/** 서버로 보낼 수 있는 검색어인지 (길이 하한은 호출하는 쪽에서 본다) */
export function isSearchableQuery(query: string): boolean {
	return SEARCH_QUERY_PATTERN.test(query);
}
