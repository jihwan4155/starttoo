import type {
	ArchiveItem,
	ArchivePage,
	ArchivePageQuery,
	ArchiveStateResponse,
	ArchiveToggleResponse,
	TattooDesignItemDto,
} from "../types/archive";
import type { CursorPage } from "../types/community";
import { api } from "./api";

function mapTattooDesignItem(dto: TattooDesignItemDto): ArchiveItem {
	// subjects가 없는 도안(주제 미태깅)도 응답에 올 수 있다 — 접근 시 TypeError로
	// 도안 보관함 전체가 "불러오지 못했습니다"로 죽지 않게 옵셔널로 읽는다.
	const primaryStyle =
		dto.subjects?.[0]?.subjectName ??
		(dto.primaryStyleSeq != null ? String(dto.primaryStyleSeq) : "");

	return {
		tattooId: dto.tattooSeq,
		designImageSeq: dto.designImageSeq,
		originalImageUrl: dto.designImageUrl,
		designImageUrl: dto.designImageUrl,
		primaryStyle,
		secondaryStyle: "",
		rendering: "",
		savedAt: dto.archivedDttm,
	};
}

/** GET /archive — 도안 보관함 (커서 페이지네이션) */
export async function getArchive(
	query: ArchivePageQuery = {},
): Promise<ArchivePage> {
	const { data } = await api.get<CursorPage<TattooDesignItemDto>>("/archive", {
		params: query,
	});
	return {
		items: data.items.map(mapTattooDesignItem),
		nextCursor: data.nextCursor,
		hasNext: data.hasNext,
	};
}

function toToggleResponse(
	tattooId: number,
	state: ArchiveStateResponse,
): ArchiveToggleResponse {
	return {
		tattooId,
		saved: state.enabled,
		savedAt: state.enabled ? new Date().toISOString() : null,
	};
}

/** PUT /archive/{tattooSeq} — 도안 보관함 저장 */
export async function saveToArchive(
	tattooId: number,
): Promise<ArchiveToggleResponse> {
	const { data } = await api.put<ArchiveStateResponse>(`/archive/${tattooId}`);
	return toToggleResponse(tattooId, data);
}

/** DELETE /archive/{tattooSeq} — 도안 보관함 삭제 */
export async function removeFromArchive(
	tattooId: number,
): Promise<ArchiveToggleResponse> {
	const { data } = await api.delete<ArchiveStateResponse>(
		`/archive/${tattooId}`,
	);
	return toToggleResponse(tattooId, data);
}
