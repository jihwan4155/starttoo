/**
 * 백엔드 Preference 도메인 타입 (회원가입 최초 취향 설문)
 * 기준: https://starttoo.duckdns.org/v3/api-docs (2026-07-31 확인)
 */

/** POST /preferences/survey 요청 */
export type PreferenceSurveyRequest = {
	/** 고른 도안의 주 스타일 seq — 중복은 서버가 제거한다 */
	primaryStyleSeqs: number[];
	/** 고르지 않았으면 빈 배열로 보낸다 */
	colorSeqs?: number[];
};

export type PreferenceScore = {
	classificationSeq: number;
	score: number;
};

/** POST /preferences/survey 응답 */
export type PreferencesResponse = {
	primaryStyles: PreferenceScore[];
	colors: PreferenceScore[];
};
