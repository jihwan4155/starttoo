import { useState } from "react";
import ActionConfirmModal from "../common/ActionConfirmModal";
import useLoginPromptStore from "../../store/useLoginPromptStore";
import LoginModal from "./LoginModal";

/**
 * 로그인이 필요한 동작을 눌렀을 때의 안내 → 로그인 흐름.
 *
 * 레이아웃에 한 번만 두고, 띄우는 쪽은 useRequireAuth가 스토어로 신호만 준다.
 * 안내에서 "로그인"을 누르면 이 자리에서 바로 로그인 창으로 바뀐다 — 두 창이
 * 겹쳐 뜨지 않도록 안내를 먼저 닫는다.
 */
export default function LoginPromptHost() {
	const isPromptOpen = useLoginPromptStore((s) => s.isOpen);
	const closeLoginPrompt = useLoginPromptStore((s) => s.closeLoginPrompt);
	const redirectTo = useLoginPromptStore((s) => s.redirectTo);
	const [isLoginOpen, setLoginOpen] = useState(false);

	return (
		<>
			<ActionConfirmModal
				isOpen={isPromptOpen}
				title="로그인이 필요한 서비스 입니다"
				description="로그인 하시겠습니까?"
				cancelText="닫기"
				confirmText="로그인"
				onClose={closeLoginPrompt}
				onConfirm={() => {
					closeLoginPrompt();
					setLoginOpen(true);
				}}
			/>
			<LoginModal
				isOpen={isLoginOpen}
				onClose={() => setLoginOpen(false)}
				redirectTo={redirectTo}
			/>
		</>
	);
}
