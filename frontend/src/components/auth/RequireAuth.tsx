import { Navigate, Outlet, useLocation } from "react-router-dom";
import { POST_LOGIN_REDIRECT_STORAGE_KEY } from "../../constants/auth";
import useAuthStore from "../../store/useAuthStore";

/**
 * 로그인이 필요한 라우트 묶음의 부모. 미로그인 상태면 로그인 화면으로 보내고,
 * 가려던 경로를 보관해 뒀다가 OAuth 콜백이 로그인 성공 후 그리로 돌려보낸다.
 */
export default function RequireAuth() {
	const accessToken = useAuthStore((s) => s.accessToken);
	const location = useLocation();

	if (!accessToken) {
		sessionStorage.setItem(
			POST_LOGIN_REDIRECT_STORAGE_KEY,
			location.pathname + location.search,
		);
		return <Navigate to="/login" replace />;
	}
	return <Outlet />;
}
