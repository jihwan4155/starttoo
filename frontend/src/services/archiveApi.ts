import { api } from "./api";
import type {
	ArchivePage,
	ArchivePageQuery,
	ArchiveToggleResponse,
} from "../types/archive";

/** GET /archive — 내 보관함 조회 (커서 페이지네이션) */
export async function getArchive(
	query: ArchivePageQuery = {},
): Promise<ArchivePage> {
	const { data } = await api.get<ArchivePage>("/archive", { params: query });
	return data;
}

/** POST /archive/{tattooId} — 보관함 저장 */
export async function saveToArchive(
	tattooId: number,
): Promise<ArchiveToggleResponse> {
	const { data } = await api.post<ArchiveToggleResponse>(
		`/archive/${tattooId}`,
	);
	return data;
}

/** DELETE /archive/{tattooId} — 보관함 삭제 */
export async function removeFromArchive(
	tattooId: number,
): Promise<ArchiveToggleResponse> {
	const { data } = await api.delete<ArchiveToggleResponse>(
		`/archive/${tattooId}`,
	);
	return data;
}
