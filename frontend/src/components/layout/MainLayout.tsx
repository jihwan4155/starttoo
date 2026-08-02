import { Outlet } from "react-router-dom";
import SideNav from "./SideNav";
import TopNav from "./TopNav";
import useSyncMeProfile from "../../hooks/useSyncMeProfile";

export default function MainLayout() {
	useSyncMeProfile();
	return (
		<div className="min-h-screen bg-white">
			<TopNav />
			<SideNav />
			<main className="ml-20 pt-[60px]">
				<Outlet />
			</main>
		</div>
	);
}
