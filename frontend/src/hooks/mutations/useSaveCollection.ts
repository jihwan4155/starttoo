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
 * 수정 API가 없어서 좌표만 바꿔도 delete 후 create가 된다.
 * 서버는 같은 도안(imageSeq)을 여러 배치에 재참조할 수 있으므로
 * 중복 imageSeq도 각각 생성한다. 로컬 샘플(imageSeq 없음)만 건너뛴다.
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

			// 1) 사라진 배치 삭제 — 좌표가 바뀐 배치는 프론트에서 collectionSeq를
			//    비우고 여기 삭제한 뒤 아래로 재생성한다.
			const toDelete = [...savedById.keys()].filter(
				(seq): seq is number => seq != null && !keptSeqs.has(seq),
			);
			for (const seq of toDelete) {
				await deleteCollection(seq);
			}

			// 2) 아직 서버에 없는 배치 생성 (같은 도안 다중 배치 허용)
			const toCreate = placements.filter((p) => p.collectionSeq == null);
			const creatable = toCreate.filter((p) => p.imageSeq != null);
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
