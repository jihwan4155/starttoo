/** 커버업 도안 형태 검색 — POST /designs/search-by-shape */

export type SearchMode = "shape" | "coverup";

export type DesignResult = {
	tattooSeq: number;
	imageUrl: string;
	score: number;
	/**
	 * 미분류 도안은 서버가 키 자체를 생략한다.
	 * (primary_styles LEFT JOIN + jackson default-property-inclusion: non_null)
	 */
	styleCode?: string;
	/** 화면 표시용 한글 라벨. styleCode는 슬러그이므로 표시하지 않는다 */
	styleName?: string;
};

export type SearchResponse = {
	mode: SearchMode;
	/**
	 * results의 길이. 삭제된 도안이 빠지면 서버가 요청한 개수보다 적으므로
	 * 16장을 전제로 화면을 짜면 안 된다.
	 */
	count: number;
	/** 검색 점수 내림차순. 프론트에서 다시 정렬하지 않는다 */
	results: DesignResult[];
};
