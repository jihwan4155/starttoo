import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import ScrollToTop from "./components/layout/ScrollToTop";
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

export default function App() {
	return (
		<BrowserRouter>
			<ScrollToTop />
			<Routes>
				{/* 폰이 QR로 진입하는 AR 화면 — 앱 셸 없이 풀스크린 */}
				<Route path="/simulations/ar/:sessionId" element={<ArJoinPage />} />
				<Route element={<MainLayout />}>
					<Route path="/" element={<HomePage />} />
					{/* API: POST /ai/generations */}
					<Route path="/ai" element={<AiPage />} />
					{/* API: POST /simulations/ar-sessions */}
					<Route path="/simulations" element={<SimulationsPage />} />
					{/* API: POST /coverups/recommendations */}
					<Route path="/coverups" element={<CoverUpPage />} />
					{/* API: GET /posts */}
					<Route path="/posts" element={<CommunityPage />} />
					{/* API: GET /posts/search */}
					<Route path="/posts/search" element={<CommunitySearchPage />} />
					{/* API: GET /dm/rooms */}
					<Route path="/dm" element={<DmPage />} />
					{/* API: GET /notifications/unread */}
					<Route path="/notifications" element={<NotificationsPage />} />
					{/* API: GET /artists */}
					<Route path="/artists" element={<TattooistPage />} />
					{/* API: GET /users/me */}
					<Route path="/mypage" element={<MyPage />} />
					{/* API: PATCH /users/me */}
					<Route path="/mypage/edit" element={<MyPageEditPage />} />
					{/* API: PATCH /artists/me */}
					<Route
						path="/mypage/artist/edit"
						element={<ArtistProfileEditPage />}
					/>
					{/* API: GET /users/{nickname} */}
					<Route path="/profile/:userId" element={<ProfilePage />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}
