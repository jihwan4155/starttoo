import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	createCollection,
	deleteCollection,
} from "../../services/collectionApi";
import { myCollectionsQueryKey } from "../queries/useMyCollections";
import { userCollectionsQueryKey } from "../queries/useUserCollections";
import type { CollectionPlacement } from "../../types/collection";

export type SaveCollectionResult = {
	created: number;
	deleted: number;
	/** imageSeq가 없어(로컬 샘플 도안) 저장하지 못한 배치 수 */
	skipped: number;
};

type SaveCollectionVariables = {
	userId: number;
	/** 편집기의 현재 배치 */
	placements: CollectionPlacement[];
	/** 서버에 저장돼 있던 배치 */
	saved: CollectionPlacement[];
};

/**
 * 컬렉션 저장 — 배치 단위 create·delete로 서버 상태를 맞춘다.
 *
 * 수정 API가 없어서 좌표만 바꿔도 delete 후 create가 된다. 다만 서버는 배치마다
 * USER_COLLECTION 타투를 새로 만들고 같은 이미지의 재등록을 409로 막으므로,
 * 삭제를 먼저 모두 끝낸 뒤 생성해야 한다. 순서를 바꾸면 옮긴 배치가 자기 자신과
 * 충돌한다.
 */
export default function useSaveCollection() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			placements,
			saved,
		}: SaveCollectionVariables): Promise<SaveCollectionResult> => {
			const savedById = new Map(
				saved.map((p) => [p.collectionSeq, p] as const),
			);
			const keptSeqs = new Set(
				placements
					.map((p) => p.collectionSeq)
					.filter((seq): seq is number => seq != null),
			);

			// 1) 사라진 배치 삭제 — 옮겨진 배치도 여기서 먼저 비워진다.
			const toDelete = [...savedById.keys()].filter(
				(seq): seq is number => seq != null && !keptSeqs.has(seq),
			);
			for (const seq of toDelete) {
				await deleteCollection(seq);
			}

			// 2) 아직 서버에 없는 배치 생성
			//    서버가 배치마다 이미지로 타투를 만들기 때문에 같은 도안은 한 번만
			//    올릴 수 있다 (두 번째는 409). 중복은 저장하지 않고 건너뛴 수에 넣는다.
			const toCreate = placements.filter((p) => p.collectionSeq == null);
			const usedImageSeqs = new Set(
				placements
					.filter((p) => p.collectionSeq != null)
					.map((p) => p.imageSeq),
			);
			const creatable = toCreate.filter((p) => {
				if (p.imageSeq == null || usedImageSeqs.has(p.imageSeq)) return false;
				usedImageSeqs.add(p.imageSeq);
				return true;
			});
			for (const placement of creatable) {
				await createCollection({
					imageSeq: placement.imageSeq as number,
					bodyView: placement.view,
					positionX: placement.x,
					positionY: placement.y,
					scaleRatio: placement.scale,
					rotationDegree: placement.rotation,
					flipped: placement.flipX ?? false,
				});
			}

			return {
				created: creatable.length,
				deleted: toDelete.length,
				skipped: toCreate.length - creatable.length,
			};
		},
		onSuccess: (_result, { userId }) => {
			void queryClient.invalidateQueries({ queryKey: myCollectionsQueryKey });
			void queryClient.invalidateQueries({
				queryKey: userCollectionsQueryKey(userId),
			});
		},
	});
}
