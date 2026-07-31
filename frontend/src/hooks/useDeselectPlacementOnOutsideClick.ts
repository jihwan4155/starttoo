import { useEffect } from "react";
import useCollectionStore from "../store/useCollectionStore";

/** 도안 이미지·핸들 밖을 클릭하면 선택 해제 */
export default function useDeselectPlacementOnOutsideClick(enabled: boolean) {
	const selectedPlacementId = useCollectionStore(
		(s) => s.selectedPlacementId,
	);
	const setSelectedPlacementId = useCollectionStore(
		(s) => s.setSelectedPlacementId,
	);

	useEffect(() => {
		if (!enabled || !selectedPlacementId) return;

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target as Element;
			if (target.closest("[data-tattoo-interactive]")) return;
			setSelectedPlacementId(null);
		};

		document.addEventListener("pointerdown", handlePointerDown, true);
		return () =>
			document.removeEventListener("pointerdown", handlePointerDown, true);
	}, [enabled, selectedPlacementId, setSelectedPlacementId]);
}
