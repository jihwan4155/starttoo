import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { CloseIcon } from "./icons";
import useBackClose from "../../hooks/useBackClose";
import useSaveToArchive from "../../hooks/mutations/useSaveToArchive";
import useRequireAuth from "../../hooks/useRequireAuth";
import type { DesignExtractResult } from "../../types/designExtract";

type DesignExtractResultModalProps = {
	result: DesignExtractResult | null;
	onClose: () => void;
};

/** 도안 추출 결과 미리보기 모달 */
export default function DesignExtractResultModal({
	result,
	onClose,
}: DesignExtractResultModalProps) {
	const navigate = useNavigate();
	const { requireAuth } = useRequireAuth();
	const {
		mutate: saveDesign,
		data: archiveState,
		variables: savingTattooSeq,
		isPending: isSaving,
		error: saveError,
	} = useSaveToArchive();
	const tattooSeq = result?.tattooSeq;
	const isCurrentDesign = tattooSeq != null && savingTattooSeq === tattooSeq;
	const isSaved = isCurrentDesign && archiveState?.saved === true;
	const currentSaveError = isCurrentDesign ? saveError : null;

	// 뒤로가기는 페이지를 떠나는 대신 이 창만 닫는다
	useBackClose(!!result, onClose);

	if (!result) return null;

	// 서버에 등록된 타투가 아니면(직접 올린 사진에서 뽑은 도안) 도안 보관함에 넣을 수
	// 없다. 대신 PNG를 내려받게 한다.
	const canSaveToArchive = result.tattooSeq != null;

	const handleAddDesign = () => {
		const seq = result.tattooSeq;
		if (seq == null) return;
		requireAuth(() => saveDesign(seq));
	};

	return createPortal(
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
							PNG 다운로드
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
							{isSaving && isCurrentDesign ? "저장 중..." : "도안 보관함에 추가"}
						</button>
					)}
				</div>
			</div>
		</div>,
		document.body,
	);
}
