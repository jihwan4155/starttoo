import { Outlet } from "react-router-dom";
import SideNav from "./SideNav";
import TopNav from "./TopNav";
import ToastHost from "../common/ToastHost";
import useDmRealtime from "../../hooks/useDmRealtime";
import type { NavResetState } from "../../hooks/useNavRefresh";
import useSyncMeProfile from "../../hooks/useSyncMeProfile";
import { useLocation } from "react-router-dom";
import MobileCommunityNav from "./MobileCommunityNav";

export default function MainLayout() {
	useSyncMeProfile();
	useDmRealtime();
	const { pathname, state } = useLocation();
	// 같은 메뉴를 다시 눌렀을 때만 값이 바뀐다(useNavRefresh 가 심는다). 이 값을 Outlet
	// 의 key 로 주면 그때만 화면이 새로 그려져, 업로드한 사진이나 추천 결과처럼 컴포넌트
	// 안에 있어 캐시 무효화로는 지워지지 않는 상태까지 초기화된다. 평소 이동에서는 값이
	// 그대로라 key 도 그대로이므로 기존 동작에 영향이 없다.
	const navResetAt = (state as NavResetState | null)?.navResetAt;
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
				<Outlet key={navResetAt ?? "initial"} />
			</main>
			{/* 라우트가 바뀌어도 유지돼야 해서 페이지가 아니라 레이아웃에 둔다 */}
			<ToastHost />
			{showCommunityNav && <MobileCommunityNav />}
		</div>
	);
}
