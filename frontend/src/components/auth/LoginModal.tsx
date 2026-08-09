import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
	POST_LOGIN_REDIRECT_STORAGE_KEY,
	isAuthFlowPath,
} from "../../constants/auth";
import useBackClose from "../../hooks/useBackClose";
import LoginPanel from "./LoginPanel";

type LoginModalProps = {
	isOpen: boolean;
	onClose: () => void;
	/**
	 * 로그인 뒤 돌아갈 곳. 비워 두면 지금 보고 있는 경로로 돌아온다.
	 *
	 * 로그인 필요 페이지에 직접 들어온 경우처럼, 창을 띄운 화면과 사용자가 원래
	 * 가려던 곳이 다를 때만 넘긴다.
	 */
	redirectTo?: string | null;
};

/**
 * 로그인 모달 — 화면을 떠나지 않고 제공자를 고른다.
 *
 * 인가 요청 자체는 카카오·구글 화면으로 완전히 이동하기 때문에, 로그인이 끝나면
 * 원래 보고 있던 경로로 돌려보내도록 모달이 열릴 때 목적지를 보관한다. (OAuth 콜백이
 * 이 값을 읽어 이동한다 — RequireAuth가 튕겨낼 때 쓰는 키와 같다.)
 */
export default function LoginModal({
	isOpen,
	onClose,
	redirectTo,
}: LoginModalProps) {
	useEffect(() => {
		if (!isOpen) return undefined;
		const destination =
			redirectTo ?? window.location.pathname + window.location.search;
		// 가입·온보딩·콜백 화면에서 연 로그인은 그 화면으로 돌아가면 안 된다. 앞선
		// 시도가 남긴 목적지를 그대로 쓰지 않도록, 저장하는 대신 지워서 홈으로 보낸다.
		if (isAuthFlowPath(new URL(destination, window.location.origin).pathname)) {
			sessionStorage.removeItem(POST_LOGIN_REDIRECT_STORAGE_KEY);
		} else {
			sessionStorage.setItem(POST_LOGIN_REDIRECT_STORAGE_KEY, destination);
		}
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [isOpen, onClose, redirectTo]);

	// 뒤로가기는 페이지를 떠나는 대신 이 창만 닫는다
	useBackClose(isOpen, onClose);

	if (!isOpen) return null;

	// z는 로그인 안내(ActionConfirmModal)와 같은 최상단이다. 안내에서 "로그인"을 누르면
	// 이 창으로 바뀌는데, 낙서 추천 결과(z-[80])나 도안 추출 결과(z-[120]) 위에서
	// 열리는 흐름이 있어 낮게 두면 안내만 고쳐도 이 창이 다시 뒤로 깔린다.
	// 둘은 동시에 뜨지 않으므로(안내를 닫고 이 창을 연다) 같은 값이어도 겹치지 않는다.
	return createPortal(
		<div
			className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40 p-6 sm:items-center"
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
