import { useCallback, useState } from "react";
import { removeFromArchive, saveToArchive } from "../services/archiveApi";

/**
 * 타투 도안 보관함 저장/삭제 토글 훅.
 * `POST·DELETE /archive/{tattooId}` 를 감싸며 서버가 돌려준 최종 상태(saved)를 신뢰한다.
 * 타투 상세·도안 카드 등 tattooId가 있는 어떤 화면에도 붙일 수 있다.
 */
export function useArchiveToggle(initialSaved = false) {
	const [saved, setSaved] = useState(initialSaved);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const toggle = useCallback(
		async (tattooId: number) => {
			setBusy(true);
			setError(null);
			try {
				const res = saved
					? await removeFromArchive(tattooId)
					: await saveToArchive(tattooId);
				setSaved(res.saved);
				return res;
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "보관함 처리에 실패했습니다.",
				);
				throw err;
			} finally {
				setBusy(false);
			}
		},
		[saved],
	);

	return { saved, busy, error, toggle, setSaved };
}
