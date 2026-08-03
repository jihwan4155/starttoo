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

/**
 * GET /collections · GET /users/{userSeq}/collections (Swagger CollectionResponse)
 *
 * positionX·positionY는 뷰 크기 기준 0~1 정규화, scaleRatio는 기준 크기 대비
 * 배율이라 로컬 CollectionPlacement의 x·y·scale과 좌표계가 같다.
 * bodyView는 서버에서 자유 문자열(최대 10자)이고 프론트가 front·back을 쓴다.
 */
export type CollectionResponse = {
	collectionSeq: number;
	ownerSeq: number;
	tattooSeq: number;
	imageSeq: number;
	/** 원본 이미지의 단기 Presigned GET URL */
	imageUrl: string | null;
	bodyView: string;
	positionX: number;
	positionY: number;
	scaleRatio: number;
	rotationDegree: number;
	flipped: boolean;
	regDttm: string;
};
