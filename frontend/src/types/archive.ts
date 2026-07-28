import type { CursorPage } from "./community";

export type ArchiveItem = {
	tattooId: number;
	originalImageUrl: string;
	designImageUrl: string;
	primaryStyle: string | null;
	secondaryStyle: string | null;
	rendering: string | null;
	savedAt: string;
};

export type ArchiveToggleResponse = {
	tattooId: number;
	saved: boolean;
	savedAt: string | null;
};

export type FetchArchiveParams = {
	cursor?: string;
	size?: number;
};

export type ArchivePage = CursorPage<ArchiveItem>;
