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
		<div className="min-h-screen bg-white">
			<TopNav />
			<SideNav />
			<main className="pt-[50px] lg:ml-20 lg:pt-[60px]">
				<Outlet />
			</main>
			{/* 라우트가 바뀌어도 유지돼야 해서 페이지가 아니라 레이아웃에 둔다 */}
			<ToastHost />
			{showCommunityNav && <MobileCommunityNav />}
		</div>
	);
}
