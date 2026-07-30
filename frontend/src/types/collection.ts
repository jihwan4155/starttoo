/** 마네킹 피부 톤 */
export type MannequinSkin = "white" | "blue" | "pink";

/** 마네킹 시점 */
export type MannequinView = "front" | "back";

export function isMannequinSkin(value: unknown): value is MannequinSkin {
	return value === "white" || value === "blue" || value === "pink";
}

export function isMannequinView(value: unknown): value is MannequinView {
	return value === "front" || value === "back";
}

/** 마네킹 위 도안 배치 (Phase 1 localStorage) */
export type CollectionPlacement = {
	id: string;
	tattooId: number;
	imageUrl: string;
	bodyPart: string;
	/** @deprecated 피부 톤과 무관 — view만 사용 */
	skin?: MannequinSkin;
	view: MannequinView;
	x: number;
	y: number;
	scale: number;
	rotation: number;
	/** 좌우 반전 */
	flipX?: boolean;
};

/** Phase 2 BE placement JSON (docs/collections-spec.md) */
export type CollectionPlacementMeta = Pick<
	CollectionPlacement,
	"skin" | "view" | "x" | "y" | "scale" | "rotation"
>;

export type ArchiveDragPayload = {
	tattooId: number;
	imageUrl: string;
};
