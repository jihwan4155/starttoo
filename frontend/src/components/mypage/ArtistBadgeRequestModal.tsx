import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import ArtistBadge from "../common/ArtistBadge";

type ArtistBadgeRequestModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

const STEPS = [
	"숍 이름·주소·전화번호·영업 안내를 프로필에 입력합니다.",
	"제출한 정보로 운영팀이 실제 영업 여부를 확인합니다.",
	"승인되면 닉네임 옆에 인증 뱃지가 표시됩니다.",
];

/**
 * 타투이스트 인증 뱃지 신청 안내
 *
 * 신청 접수 API가 아직 없어 절차 안내와 숍 정보 입력 화면 연결까지만 한다.
 * 신청 엔드포인트가 생기면 아래 버튼에 붙이면 된다.
 */
export default function ArtistBadgeRequestModal({
	isOpen,
	onClose,
}: ArtistBadgeRequestModalProps) {
	const navigate = useNavigate();

	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

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
						타투이스트 인증 뱃지 신청
					</p>
					<p className="mt-2 text-center text-[13px] font-light leading-5 text-black/50">
						인증을 받으면 타투이스트 목록에 노출되고
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

					<div className="mt-8 flex w-full gap-3">
						<button
							type="button"
							onClick={onClose}
							className="h-11 flex-1 rounded-full border border-black/15 bg-white text-[14px] font-semibold text-black transition hover:bg-black/5">
							닫기
						</button>
						<button
							type="button"
							onClick={() => {
								onClose();
								navigate("/mypage/edit");
							}}
							className="h-11 flex-1 rounded-full bg-brand text-[14px] font-semibold text-white transition hover:brightness-95">
							숍 정보 입력
						</button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}
