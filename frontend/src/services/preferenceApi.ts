import { api } from "./api";
import type {
	PreferenceSurveyRequest,
	PreferencesResponse,
} from "../types/preference";

/**
 * POST /preferences/survey — 가입 직후 최초 취향 설문 반영
 *
 * 취향 행이 하나도 없는 회원에게 한 번만 허용된다. 이후 점수는 좋아요·북마크 같은
 * 행동에서 누적되므로 온보딩에서만 호출한다.
 */
export async function submitPreferenceSurvey(
	body: PreferenceSurveyRequest,
): Promise<PreferencesResponse> {
	const { data } = await api.post<PreferencesResponse>(
		"/preferences/survey",
		body,
	);
	return data;
}
