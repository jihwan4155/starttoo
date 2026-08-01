import { api } from "./api";
import type { CursorPage } from "../types/community";
import type {
	FetchTattooDesignsParams,
	TattooDesignItem,
} from "../types/tattoo";

/** GET /tattoo-designs — 공개 타투 도안 목록 (비로그인도 조회 가능) */
export async function fetchTattooDesigns(
	params?: FetchTattooDesignsParams,
): Promise<CursorPage<TattooDesignItem>> {
	const { data } = await api.get<CursorPage<TattooDesignItem>>(
		"/tattoo-designs",
		{ params },
	);
	return data;
}
