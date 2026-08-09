import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuthStore from "../../store/useAuthStore";
import useLoginPromptStore from "../../store/useLoginPromptStore";

/**
 * 로그인이 필요한 라우트 묶음의 부모.
 *
 * 로그인 요구는 전부 모달로 받는다. 액션(좋아요·팔로우·글쓰기)은 이미 제자리에서
 * 안내 모달을 띄우고 있었고 로그인 필요 페이지만 /login 화면으로 튕겨 냈는데,
 * 같은 말을 두 가지 모습으로 만나지 않도록 모달 쪽으로 모았다.
 *
 * 다만 이 자리에서는 모달만 띄우고 머무를 수가 없다. 로그인 필요 페이지는 비로그인
 * 상태로 그리면 조회가 전부 401이라, 모달 뒤에 깔 화면이 성하지 않다. 그래서 홈으로
 * 옮긴 뒤 그 위에 안내를 띄운다 — 가려던 곳은 스토어로 넘겨, 로그인 뒤 홈이 아니라
 * 그 페이지로 돌아가게 한다.
 */
export default function RequireAuth() {
	const accessToken = useAuthStore((s) => s.accessToken);
	const openLoginPrompt = useLoginPromptStore((s) => s.openLoginPrompt);
	const location = useLocation();
	const isBlocked = !accessToken;
	const intended = location.pathname + location.search;

	useEffect(() => {
		if (isBlocked) openLoginPrompt(intended);
	}, [isBlocked, intended, openLoginPrompt]);

	if (isBlocked) return <Navigate to="/" replace />;
	return <Outlet />;
}
