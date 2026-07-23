import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import CommunityPage from "./pages/CommunityPage";
import CommunitySearchPage from "./pages/CommunitySearchPage";
import CoverUpPage from "./pages/CoverUpPage";
import DmPage from "./pages/DmPage";
import HomePage from "./pages/HomePage";
import AiPage from "./pages/AiPage";
import MyPage from "./pages/MyPage";
import MyPageEditPage from "./pages/MyPageEditPage";
import SimulationsPage from "./pages/SimulationsPage";
import TattooistPage from "./pages/TattooistPage";

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
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
					{/* API: GET /artists */}
					<Route path="/artists" element={<TattooistPage />} />
					{/* API: GET /users/me */}
					<Route path="/mypage" element={<MyPage />} />
					{/* API: PATCH /users/me */}
					<Route path="/mypage/edit" element={<MyPageEditPage />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}
