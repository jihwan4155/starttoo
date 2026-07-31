import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import logo from "../../assets/images/logo.png";

type OnboardingDialogProps = {
	title: string;
	/**
	 * X 버튼. 온보딩은 가입이 끝난 뒤에 뜨므로 어느 단계에서 닫아도 계정은 남는다.
	 * (일반 사용자 · 임시 닉네임 · 생년월일 없음 상태로 유지된다.)
	 */
	onClose: () => void;
	children: ReactNode;
};

/** 온보딩 3단계가 공유하는 모달 껍데기 — 로고·제목·닫기 버튼 */
export default function OnboardingDialog({
	title,
	onClose,
	children,
}: OnboardingDialogProps) {
	return createPortal(
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
			<div
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className="relative max-h-[90vh] w-full max-w-[420px] overflow-y-auto rounded-[16px] bg-white px-6 pb-8 pt-6 shadow-xl">
				<button
					type="button"
					aria-label="닫기"
					onClick={onClose}
					className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-black/60 transition hover:bg-black/5 hover:text-black">
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						aria-hidden>
						<path d="M5 5l14 14M19 5L5 19" />
					</svg>
				</button>

				<img src={logo} alt="" className="mx-auto h-12 w-12 object-contain" />
				<h1 className="mt-4 text-center text-[20px] font-bold text-black">
					{title}
				</h1>

				<div className="mt-7">{children}</div>
			</div>
		</div>,
		document.body,
	);
}
