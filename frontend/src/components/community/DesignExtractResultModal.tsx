import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import ArchiveFullModal from "../common/ArchiveFullModal";
import { CloseIcon } from "./icons";
import useBackClose from "../../hooks/useBackClose";
import useSaveToArchive from "../../hooks/mutations/useSaveToArchive";
import useArchiveCapacity from "../../hooks/queries/useArchiveCapacity";
import useRequireAuth from "../../hooks/useRequireAuth";
import type { DesignExtractResult } from "../../types/designExtract";
import LoadingLabel from "../loader/LoadingLabel";

type DesignExtractResultModalProps = {
	result: DesignExtractResult | null;
	onClose: () => void;
	saveButtonLabel?: string;
};

/** 도안 추출 결과 미리보기 모달 */
export default function DesignExtractResultModal({
	result,
	onClose,
	saveButtonLabel = "도안 보관함에 추가",
}: DesignExtractResultModalProps) {
	const navigate = useNavigate();
	const { requireAuth } = useRequireAuth();
	const [showArchiveFull, setShowArchiveFull] = useState(false);
	const { isFull, hasTattoo } = useArchiveCapacity();
	const {
		mutate: saveDesign,
		data: archiveState,
		variables: savingTattooSeq,
		isPending: isSaving,
		error: saveError,
	} = useSaveToArchive();
	const tattooSeq = result?.tattooSeq;
	const isCurrentDesign = tattooSeq != null && savingTattooSeq === tattooSeq;
	const isSaved =
		(tattooSeq != null && hasTattoo(tattooSeq)) ||
		(isCurrentDesign && archiveState?.saved === true);
	const currentSaveError = isCurrentDesign ? saveError : null;

	/*
	 * 뒤로가기는 페이지를 떠나는 대신 이 창만 닫는다.
	 *
	 * 보관함 안내가 떠 있는 동안 이 값을 false로 내리면, 정리 과정에서 부르는
	 * history.back()이 방금 안내창이 밀어 넣은 항목을 도로 빼서 안내창이 깜빡이고
	 * 사라진다. useBackClose 스택이 이미 맨 위 창만 닫아 주므로 그대로 열어 둔다.
	 */
	useBackClose(!!result, onClose);

	if (!result) return null;

	// 서버에 등록된 결과만 기존 archive API로 저장할 수 있다.
	const canSaveToArchive = result.tattooSeq != null;

	const handleAddDesign = () => {
		const seq = result.tattooSeq;
		if (seq == null) return;
		requireAuth(() => {
			if (isFull && !hasTattoo(seq)) {
				setShowArchiveFull(true);
				return;
			}
			saveDesign(seq);
		});
	};

	return createPortal(
		<>
			<div
				className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-6"
				onClick={onClose}
				role="presentation">
				<div
					className="flex max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white"
					onClick={(e) => e.stopPropagation()}
					role="dialog"
					aria-modal="true"
					aria-label="도안 추출 결과">
					<div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
						<p className="text-[15px] font-semibold text-black">도안 추출 결과</p>
						<button
							type="button"
							aria-label="닫기"
							onClick={onClose}
							className="text-black/60 transition hover:text-black">
							<CloseIcon size={18} />
						</button>
					</div>

					<div className="flex-1 overflow-y-auto bg-[#f5f5f5] p-5">
						<img
							src={result.previewUrl}
							alt="추출된 도안"
							className="mx-auto max-h-[55vh] w-auto rounded-lg object-contain"
						/>
					</div>

					<div className="flex items-center justify-end gap-2 border-t border-black/10 px-5 py-3">
						{currentSaveError && (
							<p className="mr-auto text-[12px] text-brand" role="alert">
								{currentSaveError.message}
							</p>
						)}
						{!canSaveToArchive ? (
							<a
								href={result.downloadUrl}
								download="tattoo-design.png"
								className="rounded-full bg-brand px-5 py-2 text-[13px] font-semibold text-white transition hover:brightness-95">
								기기에 저장
							</a>
						) : isSaved ? (
							<button
								type="button"
								onClick={() => navigate("/mypage?tab=designs")}
								className="rounded-full border border-brand px-5 py-2 text-[13px] font-semibold text-brand transition hover:bg-brand/5">
								도안 보관함 바로가기
							</button>
						) : (
							<button
								type="button"
								onClick={handleAddDesign}
								disabled={isSaving && isCurrentDesign}
								className="rounded-full bg-brand px-5 py-2 text-[13px] font-semibold text-white transition hover:brightness-95 disabled:cursor-wait disabled:opacity-60">
								{isSaving && isCurrentDesign ? (
									<LoadingLabel>저장 중…</LoadingLabel>
								) : (
									saveButtonLabel
								)}
							</button>
						)}
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
