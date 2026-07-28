import { api } from "./api";
import type {
	ArchivePage,
	ArchiveToggleResponse,
	FetchArchiveParams,
} from "../types/archive";

/** GET /archive */
export async function fetchArchive(
	params?: FetchArchiveParams,
): Promise<ArchivePage> {
	const { data } = await api.get<ArchivePage>("/archive", { params });
	return data;
}

/** POST /archive/{tattooId} */
export async function saveToArchive(
	tattooId: number,
): Promise<ArchiveToggleResponse> {
	const { data } = await api.post<ArchiveToggleResponse>(
		`/archive/${tattooId}`,
	);
	return data;
}

/** DELETE /archive/{tattooId} */
export async function removeFromArchive(
	tattooId: number,
): Promise<ArchiveToggleResponse> {
	const { data } = await api.delete<ArchiveToggleResponse>(
		`/archive/${tattooId}`,
	);
	return data;
}
