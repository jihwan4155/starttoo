import { Outlet } from "react-router-dom";
import SideNav from "./SideNav";
import TopNav from "./TopNav";
import ToastHost from "../common/ToastHost";
import useDmRealtime from "../../hooks/useDmRealtime";
import useSyncMeProfile from "../../hooks/useSyncMeProfile";
import { useLocation } from "react-router-dom";
import MobileCommunityNav from "./MobileCommunityNav";

export default function MainLayout() {
	useSyncMeProfile();
	useDmRealtime();
	const { pathname } = useLocation();
	const showCommunityNav =
		pathname === "/posts" ||
		pathname.startsWith("/posts/search") ||
		pathname.startsWith("/artists") ||
		pathname === "/mypage" ||
		pathname.startsWith("/profile/");
	return (
		/*
		 * 바닥은 100dvh다. min-h-screen(=100vh)은 모바일에서 "주소창이 숨은 상태"의
		 * 높이라, 주소창이 보이는 동안에는 문서가 화면보다 주소창 높이만큼 더 길어진다.
		 * DM처럼 화면에 딱 맞춘(100dvh) 페이지는 그 차이만큼 문서가 스크롤돼,
		 * 키보드가 닫힌 뒤 입력창 아래에 빈 흰 띠가 남은 채로 멈춘다.
		 */
		<div className="min-h-[100dvh] bg-white">
			<TopNav />
			<SideNav />
			<main className="pt-[44px] lg:ml-16 lg:pt-[52px]">
				<Outlet />
			</main>
			{/* 라우트가 바뀌어도 유지돼야 해서 페이지가 아니라 레이아웃에 둔다 */}
			<ToastHost />
			{showCommunityNav && <MobileCommunityNav />}
		</div>
	);
}
