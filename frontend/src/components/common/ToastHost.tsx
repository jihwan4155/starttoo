import { useEffect } from "react";
import { createPortal } from "react-dom";
import useToastStore from "../../store/useToastStore";
import "./ToastHost.css";

/** 등장·유지·퇴장을 합한 전체 길이 — ToastHost.css의 애니메이션 길이와 같아야 한다 */
const TOAST_MS = 2600;

/**
 * 토스트를 실제로 그리는 곳. 레이아웃에 한 번만 두고, 문구는 useToastStore로 띄운다.
 *
 * 로그아웃처럼 화면 이동이 함께 일어나는 동작에도 남아 있어야 해서 페이지가 아니라
 * 레이아웃에 마운트한다(라우트가 바뀌어도 이 컴포넌트는 유지된다).
 */
export default function ToastHost() {
	const message = useToastStore((s) => s.message);
	const seq = useToastStore((s) => s.seq);
	const hideToast = useToastStore((s) => s.hideToast);

	useEffect(() => {
		if (message === null) return undefined;
		const timer = setTimeout(hideToast, TOAST_MS);
		return () => clearTimeout(timer);
		// seq가 바뀌면 같은 문구여도 표시 시간을 처음부터 다시 센다.
	}, [message, seq, hideToast]);

	if (message === null) return null;

	return createPortal(
		<div
			// 토스트는 모달(z-60) 위에도 보여야 한다.
			className="pointer-events-none fixed inset-x-0 bottom-10 z-[70] flex justify-center px-6"
			role="status"
			aria-live="polite">
			{/* key=seq — 같은 문구를 다시 띄울 때 요소를 새로 붙여 애니메이션을 되감는다 */}
			<div
				key={seq}
				className="st-toast rounded-full bg-black/85 px-5 py-3 text-[14px] font-semibold text-white shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
				{message}
			</div>
		</div>,
		document.body,
	);
}
