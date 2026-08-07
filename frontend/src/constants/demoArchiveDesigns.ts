import demoTattooCat from "../assets/collections/demo-tattoo-cat.png";
import demoTattooTribal from "../assets/collections/demo-tattoo-tribal.png";
import type { SavedDesign } from "../types/designExtract";

/** 로컬 샘플 도안 (BE /archive 비어 있을 때 컬렉션·도안 보관함 UI용) */
export const DEMO_ARCHIVE_DESIGNS: SavedDesign[] = [
	{
		id: -1,
		previewUrl: demoTattooCat,
		downloadUrl: demoTattooCat,
		createdAt: "2026-07-29T00:00:00.000Z",
		isDemo: true,
	},
	{
		id: -2,
		previewUrl: demoTattooTribal,
		downloadUrl: demoTattooTribal,
		createdAt: "2026-07-29T00:00:00.000Z",
		isDemo: true,
	},
];

export function isDemoArchiveDesign(designId: number): boolean {
	return designId < 0;
}
