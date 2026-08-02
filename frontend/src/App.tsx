import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./components/auth/RequireAuth";
import MainLayout from "./components/layout/MainLayout";
import ScrollToTop from "./components/layout/ScrollToTop";
import OrbitLoader from "./components/orbit-loader/OrbitLoader";
import { useAppReady } from "./hooks/useAppReady";
import CommunityPage from "./pages/CommunityPage";
import CommunitySearchPage from "./pages/CommunitySearchPage";
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
import {
	GOOGLE_CALLBACK_PATH,
	KAKAO_CALLBACK_PATH,
} from "./constants/auth";

export default function App() {
	// 앱 진입 시 로고 공전 로딩 화면 → load 완료 후 페이드아웃하고 메인으로
	const { ready } = useAppReady({ minMs: 900 });
	const [showLoader, setShowLoader] = useState(true);

	return (
		<BrowserRouter>
			{showLoader && (
				<OrbitLoader
					visible={!ready}
					label={null}
					durationMs={3000}
					size={200}
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
					{/* API: GET /artists */}
					<Route path="/artists" element={<TattooistPage />} />
					{/* 피드 — 목록은 공개, 게시글 상세 진입만 로그인 필요 (페이지 안에서 처리) */}
					{/* API: GET /posts/search */}
					<Route path="/posts/search" element={<CommunitySearchPage />} />
					{/* 로그인 필요 페이지 — 미로그인 접근 시 /login으로 보낸다 */}
					<Route element={<RequireAuth />}>
						{/* API: POST /ai/generations */}
						<Route path="/ai" element={<AiPage />} />
						{/* API: POST /simulations/ar-sessions */}
						<Route path="/simulations" element={<SimulationsPage />} />
						{/* API: POST /coverups/recommendations */}
						<Route path="/coverups" element={<CoverUpPage />} />
						{/* API: GET /posts */}
						<Route path="/posts" element={<CommunityPage />} />
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
