import { api } from "./api";

/** GET /classifications/* 항목 — 네 분류가 같은 모양이다 */
export type ClassificationItem = {
	seq: number;
	code: string;
	name: string;
};

/**
 * GET /classifications/primary-styles — 주 스타일 목록
 *
 * 온보딩 스타일 설문이 code로 고른 스타일을 seq로 바꿀 때 쓴다. seq는 DB가
 * 매기는 값이라 화면에 박아 두면 환경마다 어긋날 수 있어 매번 조회해 맞춘다.
 */
export async function fetchPrimaryStyles(): Promise<ClassificationItem[]> {
	const { data } = await api.get<ClassificationItem[]>(
		"/classifications/primary-styles",
	);
	return data;
}
