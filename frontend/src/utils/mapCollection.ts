import type {
	CollectionPlacement,
	CollectionResponse,
	MannequinView,
} from "../types/collection";
import inferBodyPart from "./inferBodyPart";

function toMannequinView(bodyView: string): MannequinView {
	return bodyView === "back" ? "back" : "front";
}

/**
 * CollectionResponse → 마네킹 렌더용 배치
 *
 * 좌표·배율은 서버도 같은 정규화 공간(0~1)을 쓰므로 그대로 옮긴다.
 * bodyPart는 응답에 없고 y 좌표에서 추론하는 표시용 라벨이다 (림 워프 계산에 쓰인다).
 */
export function mapCollectionToPlacement(
	dto: CollectionResponse,
): CollectionPlacement {
	return {
		id: String(dto.collectionSeq),
		tattooId: dto.tattooSeq,
		imageUrl: dto.imageUrl ?? "",
		bodyPart: inferBodyPart(dto.positionY),
		view: toMannequinView(dto.bodyView),
		x: dto.positionX,
		y: dto.positionY,
		scale: dto.scaleRatio,
		rotation: dto.rotationDegree,
		flipX: dto.flipped,
	};
}
