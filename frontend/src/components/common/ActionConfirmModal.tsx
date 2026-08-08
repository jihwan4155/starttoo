import { createPortal } from "react-dom";
import LoadingLabel from "../loader/LoadingLabel";

type ActionConfirmModalProps = {
	isOpen: boolean;
	/** 예: "스타투님을 차단하시겠습니까?" */
	title: string;
	/** 왜 물어보는지 한 줄로. 더 붙일 말이 없으면 생략한다 */
	description?: string;
	confirmText: string;
	cancelText?: string;
	/** 요청이 나가 있는 동안 확인 버튼에 뜨는 문구 */
	pendingText?: string;
	onClose: () => void;
	onConfirm: () => void;
	/** 서버를 다녀오는 동작에서만 준다 — 그동안 두 버튼이 잠긴다 */
	isPending?: boolean;
};

/**
 * 한 번 물어보고 진행하는 작은 확인 카드 — window.confirm 대신 쓴다.
 * (차단·차단 해제, 컬렉션 배치 초기화, 로그인 안내처럼 선택지가 둘뿐인 자리)
 *
 * 히스토리를 밀어 넣는 useBackClose는 쓰지 않는다. 차단에 성공하면 호출부가
 * replace로 화면을 옮기는데, 이 창이 항목을 하나 얹어 두면 그 항목만 대체되어
 * 뒤로가기로 차단한 프로필에 다시 들어가게 된다.
 *
 * z는 이 프로젝트에서 가장 위다. 이 창은 "이미 떠 있는 무엇 위에서든" 확인을 받는
 * 자리라, 어떤 오버레이보다 위여야 한다. 예전에는 z-[60]이었는데 그때는 z-50 위에
 * 뜨는 경우만 상정했다. 실제로는 낙서 추천 결과(z-[80])나 도안 추출 결과(z-[120],
 * useRequireAuth를 직접 쓴다) 위에서도 열려서, 로그인 안내가 그 뒤에 깔려 보였다.
 *
 * 현재 프로젝트의 최상단 계층은 z-[120](삭제·신고 같은 확인 계층)이다. 여기에 층을
 * 하나 더 추가할 때는 이 값보다 낮게 두어야 한다.
 */
export default function ActionConfirmModal({
	isOpen,
	title,
	description,
	confirmText,
	cancelText = "취소",
	pendingText = "처리 중…",
	onClose,
	onConfirm,
	isPending = false,
}: ActionConfirmModalProps) {
	if (!isOpen) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-6 backdrop-blur-[2px]"
			onClick={onClose}
			role="presentation">
			<div
				className="relative w-full max-w-[360px] overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label={title}>
				<div className="flex flex-col items-center px-6 pb-6 pt-8">
					<p className="text-center text-[17px] font-bold leading-6 text-black">
						{title}
					</p>
					{description && (
						<p className="mt-3 text-center text-[13px] font-light leading-5 text-black/50">
							{description}
						</p>
					)}

					<div className="mt-8 flex w-full gap-3">
						<button
							type="button"
							onClick={onClose}
							disabled={isPending}
							className="h-11 flex-1 rounded-full border border-black/15 bg-white text-[14px] font-semibold text-black transition hover:bg-black/5 disabled:opacity-50">
							{cancelText}
						</button>
						<button
							type="button"
							onClick={onConfirm}
							disabled={isPending}
							className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-brand text-[14px] font-semibold text-white transition hover:brightness-95 disabled:opacity-50">
							{isPending ? (
								<LoadingLabel>{pendingText}</LoadingLabel>
							) : (
								confirmText
							)}
						</button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}
