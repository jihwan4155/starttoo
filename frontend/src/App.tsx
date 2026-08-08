import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./components/auth/RequireAuth";
import MainLayout from "./components/layout/MainLayout";
import ScrollToTop from "./components/layout/ScrollToTop";
import StarttooLoader from "./components/loader/StarttooLoader";
import { useAppReady } from "./hooks/useAppReady";
import CommunityPage from "./pages/CommunityPage";
import CommunitySearchPage from "./pages/CommunitySearchPage";
import PostDetailPage from "./pages/PostDetailPage";
import CoverUpPage from "./pages/CoverUpPage";
import DmPage from "./pages/DmPage";
import HomePage from "./pages/HomePage";
import AiPage from "./pages/AiPage";
import MyPage from "./pages/MyPage";
import MyPageEditPage from "./pages/MyPageEditPage";
import ArtistProfileEditPage from "./pages/ArtistProfileEditPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import SimulationsPage from "./pages/SimulationsPage";
import ArJoinPage from "./pages/ArJoinPage";
import TattooistPage from "./pages/TattooistPage";
import LoginPage from "./pages/LoginPage";
import OAuthCallbackPage from "./pages/OAuthCallbackPage";
import SignupPage from "./pages/SignupPage";
import OnboardingPage from "./pages/OnboardingPage";
import LegalPage from "./pages/LegalPage";
import {
	COMMUNITY_GUIDELINES,
	PRIVACY_POLICY,
	TERMS_OF_SERVICE,
} from "./constants/legal";
import {
	GOOGLE_CALLBACK_PATH,
	KAKAO_CALLBACK_PATH,
} from "./constants/auth";

export default function App() {
	// 앱 진입 시 로고 로딩 화면 → load 완료 후 페이드아웃하고 메인으로
	const { ready } = useAppReady({ minMs: 900 });
	const [showLoader, setShowLoader] = useState(true);

	return (
		<BrowserRouter>
			{showLoader && (
				<StarttooLoader
					variant="page"
					visible={!ready}
					label={null}
					/*
					 * 부팅 화면은 첫 프레임부터 덮어야 한다. 기본 지연(300ms)을 두면
					 * 그 사이 실제 화면이 먼저 보이고 나서 로더가 덮어, 다 불러왔는데
					 * 로딩 화면이 다시 뜬 것처럼 보인다.
					 */
					delayMs={0}
					onExited={() => setShowLoader(false)}
				/>
			)}
			<ScrollToTop />
			<Routes>
				{/* 폰이 QR로 진입하는 AR 화면 — 앱 셸 없이 풀스크린 */}
				<Route path="/simulations/ar/:sessionId" element={<ArJoinPage />} />
				<Route element={<MainLayout />}>
					<Route path="/" element={<HomePage />} />
					{/* API: POST /auth/social/login */}
					<Route path="/login" element={<LoginPage />} />
					<Route
						path={KAKAO_CALLBACK_PATH}
						element={<OAuthCallbackPage provider="KAKAO" />}
					/>
					<Route
						path={GOOGLE_CALLBACK_PATH}
						element={<OAuthCallbackPage provider="GOOGLE" />}
					/>
					{/* API: POST /auth/signup */}
					<Route path="/signup" element={<SignupPage />} />
					{/* API: PATCH /users/me · PATCH /artists/me/profile · POST /preferences/survey */}
					<Route path="/onboarding" element={<OnboardingPage />} />
					{/* 약관 문서 — 푸터와 가입 동의 화면에서 들어온다. 본문은 constants/legal.ts */}
					<Route
						path={TERMS_OF_SERVICE.path}
						element={<LegalPage doc={TERMS_OF_SERVICE} />}
					/>
					<Route
						path={PRIVACY_POLICY.path}
						element={<LegalPage doc={PRIVACY_POLICY} />}
					/>
					<Route
						path={COMMUNITY_GUIDELINES.path}
						element={<LegalPage doc={COMMUNITY_GUIDELINES} />}
					/>
					{/* API: GET /artists */}
					<Route path="/artists" element={<TattooistPage />} />
					{/* 형태 검색·추천 결과는 공개. 저장·시뮬레이션은 페이지 내부에서 로그인 확인 */}
					<Route path="/coverups" element={<CoverUpPage />} />
					{/* 피드 — 목록은 공개, 피드 상세 진입만 로그인 필요 (페이지 안에서 처리) */}
					{/* API: GET /posts/search */}
					<Route path="/posts/search" element={<CommunitySearchPage />} />
					{/* 로그인 필요 페이지 — 미로그인 접근 시 /login으로 보낸다 */}
					<Route element={<RequireAuth />}>
						{/* API: POST /ai/generations */}
						<Route path="/ai" element={<AiPage />} />
						{/* API: POST /simulations/ar-sessions */}
						<Route path="/simulations" element={<SimulationsPage />} />
						{/* API: GET /posts */}
						<Route path="/posts" element={<CommunityPage />} />
						{/* 피드 단건 주소 — DM으로 공유한 링크가 여기로 들어온다.
						    정적 세그먼트가 우선이라 위쪽 /posts/search 와 부딪히지 않는다.
						    API: GET /posts/{postId} */}
						<Route path="/posts/:postId" element={<PostDetailPage />} />
						{/* API: GET /dm/rooms */}
						<Route path="/dm" element={<DmPage />} />
						{/* API: GET /notifications/unread */}
						<Route path="/notifications" element={<NotificationsPage />} />
						{/* API: GET /users/me */}
						<Route path="/mypage" element={<MyPage />} />
						{/* API: PATCH /users/me */}
						<Route path="/mypage/edit" element={<MyPageEditPage />} />
						{/* API: PATCH /artists/me */}
						<Route
							path="/mypage/artist/edit"
							element={<ArtistProfileEditPage />}
						/>
					</Route>
					{/* API: GET /users/{nickname} */}
					<Route path="/profile/:userId" element={<ProfilePage />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}
