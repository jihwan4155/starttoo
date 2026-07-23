import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** 라우트가 바뀌어도 브라우저가 이전 스크롤 위치를 유지하므로, 경로 변경 시 맨 위로 리셋 */
export default function ScrollToTop() {
	const { pathname } = useLocation();

	useEffect(() => {
		window.scrollTo(0, 0);
	}, [pathname]);

	return null;
}
