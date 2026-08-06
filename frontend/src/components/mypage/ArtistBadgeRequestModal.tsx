import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ArtistBadge from "../common/ArtistBadge";
import useVerifyArtist from "../../hooks/mutations/useVerifyArtist";
import { ApiError } from "../../services/api";
import useToastStore from "../../store/useToastStore";

type ArtistBadgeRequestModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

const STEPS = [
	"인증하면 닉네임 옆에 인증 뱃지가 표시됩니다.",
	"타투이스트 목록에 노출되어 손님이 찾을 수 있습니다.",
	"숍 이름·주소·전화번호·영업 안내는 마이페이지에서 채웁니다.",
];

/**
 * 타투이스트 인증 뱃지
 *
 * POST /artists/me/verification을 호출한다. 서버가 운영팀 승인 단계를 생략하고
 * 호출 즉시 인증을 끝내므로, 화면에서도 "신청"이 아니라 바로 인증되는 흐름으로
 * 안내한다. 승인 절차가 생기면 문구와 성공 처리를 함께 바꿔야 한다.
 */
export default function ArtistBadgeRequestModal({
	isOpen,
	onClose,
}: ArtistBadgeRequestModalProps) {
	const showToast = useToastStore((s) => s.showToast);
	const { mutate: verify, isPending } = useVerifyArtist();
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);

	// 닫았다 다시 열면 지난 오류는 남아 있을 이유가 없다.
	useEffect(() => {
		if (isOpen) setError(null);
	}, [isOpen]);

	if (!isOpen) return null;

	const handleVerify = () => {
		setError(null);
		verify(undefined, {
			onSuccess: () => {
				showToast("타투이스트 인증이 완료되었습니다.");
				onClose();
			},
			onError: (cause) => {
				// 이미 인증된 계정(409)이면 실패라기보다 이미 끝난 상태다.
				if (cause instanceof ApiError && cause.status === 409) {
					showToast("이미 인증된 계정입니다.");
					onClose();
					return;
				}
				setError(
					cause instanceof ApiError
						? cause.message
						: "인증에 실패했습니다. 잠시 후 다시 시도해주세요.",
				);
			},
		});
	};

	return createPortal(
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-[2px]"
			onClick={onClose}
			role="presentation">
			<div
				className="w-full max-w-[380px] overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="타투이스트 인증 뱃지 신청">
				<div className="flex flex-col items-center px-6 pb-6 pt-8">
					<ArtistBadge size={44} />
					<p className="mt-4 text-[18px] font-bold text-black">
						타투이스트 인증
					</p>
					<p className="mt-2 text-center text-[13px] font-light leading-5 text-black/50">
						인증하면 타투이스트 목록에 노출되고
						<br />
						프로필에 매장 정보를 보여줄 수 있습니다.
					</p>

					<ol className="mt-6 w-full space-y-3">
						{STEPS.map((step, index) => (
							<li key={step} className="flex items-start gap-3">
								<span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">
									{index + 1}
								</span>
								<span className="text-[13px] font-light leading-5 text-black/70">
									{step}
								</span>
							</li>
						))}
					</ol>

					{error && (
						<p
							role="alert"
							className="mt-6 w-full text-center text-[13px] leading-5 text-brand">
							{error}
						</p>
					)}

					<button
						type="button"
						onClick={handleVerify}
						disabled={isPending}
						className="mt-8 h-11 w-full rounded-full bg-brand text-[14px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#FFB4B4]">
						{isPending ? "인증하는 중…" : "인증하기"}
					</button>

					{/* 숍 정보는 위 안내대로 마이페이지에서 채운다 — 여기서 바로 가는
					    버튼을 두면 인증 창에서 매장 정보를 또 적는 흐름이 된다. */}
					<button
						type="button"
						onClick={onClose}
						disabled={isPending}
						className="mt-3 h-11 w-full rounded-full border border-black/15 bg-white text-[14px] font-semibold text-black transition hover:bg-black/5 disabled:opacity-50">
						닫기
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
