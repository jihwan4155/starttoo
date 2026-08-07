import { api } from "./api";
import { MAX_RESULTS } from "../components/coverup/shapeSearchConstants";
import type { DesignResult, SearchMode, SearchResponse } from "../types/shapeSearch";

/**
 * POST /designs/search-by-shape — 마스크와 닮은 도안을 점수순으로 조회
 *
 * @param maskPngB64 검은 배경 + 흰 획 PNG의 base64. data: 접두어 포함 가능
 */
export async function searchByShape(
	maskPngB64: string,
	mode: SearchMode,
): Promise<DesignResult[]> {
	// 백엔드 ApiResponse<T> 봉투는 api.ts 응답 인터셉터가 벗겨서 준다
	const { data } = await api.post<SearchResponse>("/designs/search-by-shape", {
		maskPngB64,
		mode,
	});
	// 서버가 이미 점수 내림차순으로 주므로 다시 정렬하지 않는다.
	// 서버는 최대 16장을 주지만 한 화면에 담기도록 상위 MAX_RESULTS장만 쓴다.
	return data.results.slice(0, MAX_RESULTS);
}
