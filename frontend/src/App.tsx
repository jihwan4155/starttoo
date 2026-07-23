import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import HomePage from "./pages/HomePage";
import AiPage from "./pages/AiPage";
import PlaceholderPage from "./pages/PlaceholderPage";

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route element={<MainLayout />}>
					<Route path="/" element={<HomePage />} />
					{/* API: POST /ai/generations */}
					<Route path="/ai" element={<AiPage />} />
					{/* API: POST /simulations/ar-sessions */}
					<Route
						path="/simulations"
						element={<PlaceholderPage title="타투 시뮬레이션" />}
					/>
					{/* API: POST /coverups/recommendations */}
					<Route
						path="/coverups"
						element={<PlaceholderPage title="커버업 타투" />}
					/>
					{/* API: GET /posts */}
					<Route
						path="/posts"
						element={<PlaceholderPage title="커뮤니티" />}
					/>
					<Route path="*" element={<Navigate to="/" replace />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}
