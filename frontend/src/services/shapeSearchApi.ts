import { api } from "./api";
import demoTattoo from "../assets/images/demo-tattoo.png";
import { DEMO_MODE } from "../constants/config";
import type {
	DesignResult,
	SearchMode,
	SearchResponse,
} from "../types/shapeSearch";

/**
 * 백엔드 성공 응답은 ApiResponse<T>로 한 겹 감싸져 있다.
 * 예: {"data":{"mode":"coverup","count":16,"results":[...]}}
 *
 * 전역 언랩(api.ts 응답 인터셉터)이 올바른 해결이지만 기존 서비스 전체에 영향이
 * 가므로 별도 작업으로 뺐다. 그때까지는 이 서비스에서만 벗긴다.
 */
type Envelope<T> = { data: T };

const DEMO_RESULT_COUNT = 16;
const DEMO_DELAY_MS = 900;

// 미분류 도안은 서버가 styleCode·styleName 키를 아예 생략한다. 그 경우도 재현한다.
const DEMO_STYLES: Array<Pick<DesignResult, "styleCode" | "styleName">> = [
	{ styleCode: "geometric_ornamental", styleName: "기하·장식" },
	{ styleCode: "minimal", styleName: "미니멀" },
	{ styleCode: "japanese", styleName: "재패니즈" },
	{},
];

function demoResults(): DesignResult[] {
	return Array.from({ length: DEMO_RESULT_COUNT }, (_, index) => ({
		tattooSeq: 900_000 + index,
		imageUrl: demoTattoo,
		// 서버는 점수 내림차순으로 준다
		score: Number((0.92 - index * 0.03).toFixed(2)),
		...DEMO_STYLES[index % DEMO_STYLES.length],
	}));
}

/**
 * POST /designs/search-by-shape — 마스크와 닮은 도안을 점수순으로 조회
 *
 * @param maskPngB64 검은 배경 + 흰 획 PNG의 base64. data: 접두어 포함 가능
 */
export async function searchByShape(
	maskPngB64: string,
	mode: SearchMode,
): Promise<DesignResult[]> {
	// 시연·개발용: 검색 엔진(COVERUP_ENABLED 기본 false)이 없으면 서버가 503이다
	if (DEMO_MODE) {
		await new Promise((resolve) => {
			setTimeout(resolve, DEMO_DELAY_MS);
		});
		return demoResults();
	}

	const { data } = await api.post<Envelope<SearchResponse>>(
		"/designs/search-by-shape",
		{ maskPngB64, mode },
	);
	// 서버가 이미 점수 내림차순으로 주므로 다시 정렬하지 않는다
	return data.data.results;
}
