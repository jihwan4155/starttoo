import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import ArchiveFullModal from "../common/ArchiveFullModal";
import LoadingLabel from "../loader/LoadingLabel";
import useArchiveCapacity from "../../hooks/queries/useArchiveCapacity";
import useRequireAuth from "../../hooks/useRequireAuth";
import { saveToArchive } from "../../services/archiveApi";
import useSimulationHandoff from "../../store/useSimulationHandoff";
import useToastStore from "../../store/useToastStore";
import type { DesignResult } from "../../types/shapeSearch";

type DoodleResultModalProps = {
	results: DesignResult[];
	/** 낙서장으로 돌아가 다시 그린다 */
	onRedraw: () => void;
	/** 결과와 낙서장을 함께 닫는다 */
	onClose: () => void;
};

function CloseIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
			<path
				d="M6 6l12 12M18 6 6 18"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="round"
			/>
		</svg>
	);
}

/**
 * 낙서 검색 결과.
 *
 * <p>커버업 페이지로 넘기지 않고 홈에서 바로 보여 준다. 커버업은 로그인 전용
 * 화면이고 신체 사진부터 다시 받는 흐름이라, 낙서 한 장으로 도안만 보고 싶은
 * 사람에게는 과한 우회였다.
 *
 * <p>저장·시뮬레이션은 로그인이 필요하다. 여기서는 막지 않고 눌렀을 때
 * useRequireAuth가 로그인 안내를 띄운다 — 결과는 비로그인도 볼 수 있게 둔다.
 */
export default function DoodleResultModal({
	results,
	onRedraw,
	onClose,
}: DoodleResultModalProps) {
	const navigate = useNavigate();
	const { requireAuth } = useRequireAuth();
	const showToast = useToastStore((s) => s.showToast);
	const startSimulation = useSimulationHandoff((s) => s.start);
	const { isFull, hasTattoo } = useArchiveCapacity();

	const [selectedIndex, setSelectedIndex] = useState(0);
	const [showArchiveFull, setShowArchiveFull] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const saveMutation = useMutation({ mutationFn: saveToArchive });

	const selected = results[selectedIndex] ?? null;

	const handleSave = () => {
		if (!selected) return;
		setSaveError(null);
		requireAuth(() => {
			if (isFull && !hasTattoo(selected.tattooSeq)) {
				setShowArchiveFull(true);
				return;
			}
			saveMutation.mutate(selected.tattooSeq, {
				onSuccess: () => showToast("도안 보관함에 저장했습니다."),
				onError: () => setSaveError("저장하지 못했습니다. 잠시 후 다시 시도해주세요."),
			});
		});
	};

	const handleSimulate = () => {
		if (!selected) return;
		requireAuth(() => {
			// 낙서에서는 도안만 넘긴다 — 신체 사진은 시뮬레이션 화면에서 고른다.
			startSimulation({
				bodyPhoto: null,
				designUrl: selected.imageUrl,
				scan: null,
			});
			onClose();
			navigate("/simulations");
		});
	};

	return createPortal(
		<>
			<div
				className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center sm:p-6"
				onClick={onClose}
				role="presentation">
				<div
					className="flex max-h-[90vh] w-full max-w-[600px] flex-col overflow-hidden rounded-[14px] bg-white px-4 pb-4 pt-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)] sm:max-w-[680px] sm:px-5"
					onClick={(event) => event.stopPropagation()}
					role="dialog"
					aria-modal="true"
					aria-label="추천 도안">
					<div className="mb-3 flex shrink-0 items-center justify-between">
						<h2 className="text-[16px] font-extrabold text-black sm:text-[17px]">
							추천 도안
						</h2>
						<button
							type="button"
							aria-label="닫기"
							onClick={onClose}
							className="flex size-8 items-center justify-center rounded-full text-black/70 transition hover:bg-black/5 hover:text-black">
							<CloseIcon />
						</button>
					</div>

					<p className="mb-3 shrink-0 text-center text-[13px] font-light text-black/55">
						그린 모양을 닮은 도안이에요. 저장하거나 내 몸에 시뮬레이션해보세요
					</p>

					<div className="min-h-0 flex-1 overflow-y-auto">
						{selected && (
							<div className="mx-auto flex aspect-square w-full max-w-[320px] items-center justify-center overflow-hidden rounded-[12px] border border-black/10 bg-white">
								<img
									src={selected.imageUrl}
									alt="선택한 추천 도안"
									className="size-full object-contain"
								/>
							</div>
						)}

						<div className="mt-3 flex gap-2 overflow-x-auto pb-1">
							{results.map((result, index) => (
								<button
									key={result.tattooSeq}
									type="button"
									onClick={() => setSelectedIndex(index)}
									aria-pressed={selectedIndex === index}
									aria-label={`추천 도안 ${index + 1}`}
									className={`size-[72px] shrink-0 overflow-hidden rounded-[10px] bg-white transition ${
										selectedIndex === index
											? "border-[3px] border-brand"
											: "border border-black/15 hover:border-black/30"
									}`}>
									<img
										src={result.imageUrl}
										alt=""
										className="size-full object-contain"
									/>
								</button>
							))}
						</div>
					</div>

					{saveError && (
						<p role="alert" className="mt-3 shrink-0 text-center text-[13px] text-brand">
							{saveError}
						</p>
					)}

					<div className="mt-4 flex shrink-0 flex-wrap justify-center gap-2.5">
						<button
							type="button"
							onClick={onRedraw}
							className="h-11 min-w-[110px] rounded-full border border-black/15 px-5 text-[14px] font-semibold text-black/65 transition hover:bg-black/5">
							다시 그리기
						</button>
						<button
							type="button"
							onClick={handleSave}
							disabled={saveMutation.isPending || !selected}
							className="h-11 min-w-[150px] rounded-full border border-brand px-5 text-[14px] font-semibold text-brand transition hover:bg-brand/5 disabled:opacity-50">
							{saveMutation.isPending ? (
								<LoadingLabel>저장 중…</LoadingLabel>
							) : (
								"도안 보관함에 저장"
							)}
						</button>
						<button
							type="button"
							onClick={handleSimulate}
							disabled={!selected}
							className="h-11 min-w-[150px] rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition hover:brightness-95 disabled:opacity-50">
							시뮬레이션 해보기
						</button>
					</div>
				</div>
			</div>

			<ArchiveFullModal
				isOpen={showArchiveFull}
				onClose={() => setShowArchiveFull(false)}
			/>
		</>,
		document.body,
	);
}
