import { DEMO_ARCHIVE_DESIGNS } from "../constants/demoArchiveDesigns";
import type { SavedDesign } from "../types/designExtract";

/** GET /archive 결과 + 로컬 샘플 도안 병합 (API id와 중복 없음) */
export default function mergeWithDemoArchiveDesigns(
	designs: SavedDesign[],
): SavedDesign[] {
	const apiIds = new Set(designs.map((design) => design.id));
	const extras = DEMO_ARCHIVE_DESIGNS.filter((design) => !apiIds.has(design.id));
	return [...extras, ...designs];
}
