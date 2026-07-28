import { Navigate } from "react-router-dom";

/** @deprecated /mypage/edit에 숍 정보 통합 — 기존 링크 호환용 리다이렉트 */
export default function ArtistProfileEditPage() {
	return <Navigate to="/mypage/edit" replace />;
}
