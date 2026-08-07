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

/** 마네킹 위 도안 배치 */
export type CollectionPlacement = {
	id: string;
	tattooId: number;
	/**
	 * 서버 배치 식별자. 아직 저장되지 않은 배치는 없다.
	 * DELETE /collections/{collectionSeq}에 쓴다.
	 */
	collectionSeq?: number;
	/** POST /collections의 imageSeq. 로컬 샘플 도안에는 없어 저장할 수 없다. */
	imageSeq?: number;
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
	/** 없으면 로컬 샘플 도안 — 마네킹에는 놓이지만 서버 저장에서 빠진다 */
	imageSeq?: number;
};

/**
 * GET /collections · GET /users/{userSeq}/collections (Swagger CollectionResponse)
 *
 * positionX·positionY는 뷰 크기 기준 0~1 정규화, scaleRatio는 기준 크기 대비
 * 배율이라 로컬 CollectionPlacement의 x·y·scale과 좌표계가 같다.
 * bodyView는 서버에서 자유 문자열(최대 10자)이고 프론트가 front·back을 쓴다.
 */
/** POST /collections 요청 */
export type CreateCollectionRequest = {
	/** 도안 보관함 항목의 designImageSeq */
	imageSeq: number;
	/** front · back */
	bodyView: string;
	/** 0~1 정규화 */
	positionX: number;
	positionY: number;
	/** 0 초과 */
	scaleRatio: number;
	/** -180~180 */
	rotationDegree: number;
	flipped: boolean;
};

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
