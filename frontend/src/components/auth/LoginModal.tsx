import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
	POST_LOGIN_REDIRECT_STORAGE_KEY,
	isAuthFlowPath,
} from "../../constants/auth";
import LoginPanel from "./LoginPanel";

type LoginModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

/**
 * 로그인 모달 — 화면을 떠나지 않고 제공자를 고른다.
 *
 * 인가 요청 자체는 카카오·구글 화면으로 완전히 이동하기 때문에, 로그인이 끝나면
 * 원래 보고 있던 경로로 돌려보내도록 모달이 열릴 때 목적지를 보관한다. (OAuth 콜백이
 * 이 값을 읽어 이동한다 — RequireAuth가 튕겨낼 때 쓰는 키와 같다.)
 */
export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
	useEffect(() => {
		if (!isOpen) return undefined;
		// 가입·온보딩·콜백 화면에서 연 로그인은 그 화면으로 돌아가면 안 된다. 앞선
		// 시도가 남긴 목적지를 그대로 쓰지 않도록, 저장하는 대신 지워서 홈으로 보낸다.
		if (isAuthFlowPath(window.location.pathname)) {
			sessionStorage.removeItem(POST_LOGIN_REDIRECT_STORAGE_KEY);
		} else {
			sessionStorage.setItem(
				POST_LOGIN_REDIRECT_STORAGE_KEY,
				window.location.pathname + window.location.search,
			);
		}
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-6 sm:items-center"
			onClick={onClose}
			role="presentation">
			<div
				className="relative w-full max-w-[380px] rounded-2xl bg-white px-7 pb-8 pt-12 shadow-xl"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="로그인">
				<button
					type="button"
					aria-label="닫기"
					onClick={onClose}
					className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-black transition hover:bg-black/5">
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round">
						<path d="M5 5l14 14M19 5L5 19" />
					</svg>
				</button>

				<p className="text-center text-[24px] font-extrabold text-black">
					로그인
				</p>

				<div className="mt-8">
					<LoginPanel />
				</div>
			</div>
		</div>,
		document.body,
	);
}
