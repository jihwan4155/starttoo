import { useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";
import useBackClose from "../../hooks/useBackClose";
import useReportPost from "../../hooks/mutations/useReportPost";
import { ApiError } from "../../services/api";
import { REPORT_REASONS } from "../../constants/community";
import type { ReportReasonCode } from "../../types/community";

type ReportPostModalProps = {
	postId: number;
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: () => void;
};

/** 게시글 신고 모달 */
export default function ReportPostModal({
	postId,
	isOpen,
	onClose,
	onSuccess,
}: ReportPostModalProps) {
	const [reasonCode, setReasonCode] = useState<ReportReasonCode>("SPAM");
	const [reasonDetail, setReasonDetail] = useState("");
	const { mutate, isPending } = useReportPost();

	// 뒤로가기는 페이지를 떠나는 대신 이 창만 닫는다
	useBackClose(isOpen, onClose);

	if (!isOpen) return null;

	const handleSubmit = () => {
		if (reasonCode === "OTHER" && !reasonDetail.trim()) {
			window.alert("기타 사유를 입력해 주세요.");
			return;
		}
		mutate(
			{
				postId,
				reasonCode,
				reasonDetail:
					reasonCode === "OTHER" ? reasonDetail.trim() : undefined,
			},
			{
				onSuccess: () => {
					window.alert("신고가 접수되었습니다.");
					onSuccess?.();
					onClose();
				},
				onError: (err) => {
					window.alert(
						err instanceof ApiError
							? err.message
							: "신고에 실패했습니다.",
					);
				},
			},
		);
	};

	return createPortal(
		<div
			className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-6"
			onClick={onClose}
			role="presentation">
			<div
				className="flex w-full max-w-[440px] flex-col rounded-2xl bg-white"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="게시글 신고">
				<div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
					<p className="text-[15px] font-semibold text-black">게시글 신고</p>
					<button
						type="button"
						aria-label="닫기"
						onClick={onClose}
						className="text-black/60 transition hover:text-black">
						<CloseIcon size={18} />
					</button>
				</div>

				<div className="space-y-2 px-5 py-4">
					{REPORT_REASONS.map((reason) => (
						<label
							key={reason.code}
							className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-black/5">
							<input
								type="radio"
								name="report-reason"
								checked={reasonCode === reason.code}
								onChange={() => setReasonCode(reason.code)}
								className="accent-brand"
							/>
							<span className="text-[14px] text-black">{reason.label}</span>
						</label>
					))}
					{reasonCode === "OTHER" && (
						<textarea
							value={reasonDetail}
							onChange={(e) => setReasonDetail(e.target.value)}
							placeholder="신고 사유를 입력해 주세요"
							rows={3}
							className="mt-2 w-full resize-none rounded-lg border border-black/15 px-3 py-2 text-[13px] outline-none focus:border-brand"
						/>
					)}
				</div>

				<div className="flex justify-end gap-2 border-t border-black/10 px-5 py-3">
					<button
						type="button"
						onClick={onClose}
						disabled={isPending}
						className="rounded-full px-5 py-2 text-[13px] font-semibold text-black/60 transition hover:bg-black/5">
						취소
					</button>
					<button
						type="button"
						onClick={handleSubmit}
						disabled={isPending}
						className="rounded-full bg-brand px-5 py-2 text-[13px] font-semibold text-white transition hover:brightness-95 disabled:opacity-50">
						{isPending ? "접수 중…" : "신고하기"}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
