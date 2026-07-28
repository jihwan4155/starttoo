import type { ArchiveItem } from "../types/archive";
import type { SavedDesign } from "../types/designExtract";

/** GET /archive 항목 → 마이페이지 도안 그리드 표시용 */
export function mapArchiveItemToSavedDesign(item: ArchiveItem): SavedDesign {
	return {
		id: item.tattooId,
		previewUrl: item.designImageUrl || item.originalImageUrl,
		downloadUrl: item.designImageUrl || item.originalImageUrl,
		createdAt: item.savedAt,
	};
}
