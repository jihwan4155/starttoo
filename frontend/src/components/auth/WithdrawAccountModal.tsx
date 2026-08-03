import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { REAUTH_REQUIRED_STORAGE_KEY } from "../../constants/auth";
import { ApiError } from "../../services/api";
import { withdrawMe } from "../../services/userApi";
import useAuthStore from "../../store/useAuthStore";

type WithdrawAccountModalProps = {
	isOpen: boolean;
	onClose: () => void;
	/** 탈퇴가 끝난 뒤 화면 이동 등 후처리 */
	onWithdrawn: () => void;
};

/**
 * 탈퇴하면 실제로 벌어지는 일.
 *
 * 백엔드(UserService.withdraw)는 계정 상태를 WITHDRAWN으로 바꾸고 Refresh Token·푸시
 * 기기를 정리한 뒤 검색 인덱스에서 내린다. 닉네임과 휴대폰 번호는 신규 가입에서 다시
 * 쓸 수 있으므로(API 스펙 12.9) "일정 기간 재가입 제한" 같은 안내는 사실과 다르다.
 */
const CONSEQUENCES = [
	"바로 로그아웃되고 다시 로그인할 수 없습니다.",
	"작성한 게시글·컬렉션과 팔로우·DM을 더 이상 이용할 수 없습니다.",
	"탈퇴한 계정은 스스로 되돌릴 수 없습니다.",
	"같은 소셜 계정으로 다시 가입하면 이전 기록이 이어지지 않는 새 계정으로 시작합니다.",
];

export default function WithdrawAccountModal({
	isOpen,
	onClose,
	onWithdrawn,
}: WithdrawAccountModalProps) {
	const clearSession = useAuthStore((s) => s.clearSession);
	const [agreed, setAgreed] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// 닫았다 다시 열면 동의 체크와 오류를 초기화한다.
	useEffect(() => {
		if (!isOpen) return;
		setAgreed(false);
		setError(null);
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return undefined;
		const onKey = (e: KeyboardEvent) => {
			// 진행 중에는 실수로 닫히지 않게 둔다.
			if (e.key === "Escape" && !submitting) onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [isOpen, submitting, onClose]);

	if (!isOpen) return null;

	const handleWithdraw = async () => {
		setError(null);
		setSubmitting(true);
		try {
			await withdrawMe();
			// 서버가 이미 토큰을 폐기했으므로 로그아웃 호출 없이 로컬 세션만 비운다.
			// 브라우저에 남은 카카오·구글 계정 세션 때문에 다음 로그인이 조용히 통과되면
			// 의도치 않게 새 계정이 만들어질 수 있어, 계정 선택을 다시 받도록 표시한다.
			localStorage.setItem(REAUTH_REQUIRED_STORAGE_KEY, "1");
			clearSession();
			onWithdrawn();
		} catch (cause) {
			setError(
				cause instanceof ApiError
					? cause.message
					: "탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
			);
			setSubmitting(false);
		}
	};

	return createPortal(
		<div
			className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-6 sm:items-center"
			onClick={() => !submitting && onClose()}
			role="presentation">
			<div
				className="relative w-full max-w-[420px] rounded-2xl bg-white px-7 pb-7 pt-10"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="회원탈퇴">
				<p className="text-center text-[22px] font-extrabold text-black">
					정말 탈퇴하시겠어요?
				</p>

				<ul className="mt-6 flex flex-col gap-2 rounded-[12px] bg-black/[0.03] px-5 py-4">
					{CONSEQUENCES.map((text) => (
						<li
							key={text}
							className="flex gap-2 text-[13px] leading-5 text-black/70">
							<span aria-hidden className="text-brand">
								•
							</span>
							<span>{text}</span>
						</li>
					))}
				</ul>

				<label className="mt-5 flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-black/70">
					<input
						type="checkbox"
						checked={agreed}
						onChange={(e) => setAgreed(e.target.checked)}
						disabled={submitting}
						className="size-4 accent-brand"
					/>
					위 안내를 모두 확인했습니다.
				</label>

				{error && (
					<p role="alert" className="mt-4 text-[13px] leading-5 text-brand">
						{error}
					</p>
				)}

				<div className="mt-6 flex gap-3">
					<button
						type="button"
						onClick={onClose}
						disabled={submitting}
						className="h-[52px] flex-1 rounded-full border border-black/20 bg-white text-[16px] font-semibold text-black transition hover:bg-black/5 disabled:opacity-50">
						취소
					</button>
					<button
						type="button"
						onClick={() => void handleWithdraw()}
						disabled={!agreed || submitting}
						className="h-[52px] flex-1 rounded-full bg-brand text-[16px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#FFB4B4]">
						{submitting ? "탈퇴 중…" : "탈퇴하기"}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
