import { Link, useLocation, useNavigate } from "react-router-dom";
import useNavRefresh from "../../hooks/useNavRefresh";

type NavIconName = "community" | "feed" | "artist" | "profile";

function NavIcon({ name }: { name: NavIconName }) {
	if (name === "community") {
		return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 5.5h16v11H9l-5 3v-14Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
	}
	if (name === "feed") {
		return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2"/></svg>;
	}
	if (name === "artist") {
		return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="2"/><path d="M3.5 20v-2a5 5 0 0 1 5-5h3a5 5 0 0 1 3.7 1.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="m18.5 12 .9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3.9-1.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>;
	}
	return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/><path d="M4.5 21v-2.5A5.5 5.5 0 0 1 10 13h4a5.5 5.5 0 0 1 5.5 5.5V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}

const items = [
	{ label: "피드", to: "/posts", icon: "community" },
	{ label: "탐색", to: "/posts/search", icon: "feed" },
	{ label: "타투이스트", to: "/artists", icon: "artist" },
	{ label: "마이페이지", to: "/mypage", icon: "profile" },
] as const;

export default function MobileCommunityNav() {
	const { pathname } = useLocation();
	const navigate = useNavigate();
	// 보고 있는 화면의 메뉴를 다시 누르면 새로고침
	const navRefresh = useNavRefresh();
	const active = (to: string) => to === "/posts" ? pathname === "/posts" : pathname.startsWith(to);

	return (
		<nav className="fixed inset-x-0 bottom-0 z-[55] hidden h-[76px] rounded-t-[20px] border-t border-black/5 bg-white px-3 shadow-[0_-5px_24px_rgba(0,0,0,0.10)] max-lg:grid max-lg:grid-cols-5" aria-label="커뮤니티 하단 메뉴">
			{items.slice(0, 2).map((item) => (
				<Link key={item.to} to={item.to} onClick={navRefresh(item.to)} className={`flex flex-col items-center justify-center gap-1 text-[12px] ${active(item.to) ? "text-brand" : "text-[#333]"}`} aria-current={active(item.to) ? "page" : undefined}>
					<NavIcon name={item.icon} /><span>{item.label}</span>
				</Link>
			))}
			<button type="button" onClick={() => navigate("/posts?compose=1")} aria-label="새 게시물 만들기" className="mx-auto -mt-4 flex size-14 items-center justify-center self-center rounded-full bg-brand text-[38px] font-extralight leading-none text-white shadow-[0_6px_18px_rgba(255,76,76,0.35)]">＋</button>
			{items.slice(2).map((item) => (
				<Link key={item.to} to={item.to} onClick={navRefresh(item.to)} className={`flex flex-col items-center justify-center gap-1 text-[12px] ${active(item.to) ? "text-brand" : "text-[#333]"}`} aria-current={active(item.to) ? "page" : undefined}>
					<NavIcon name={item.icon} /><span>{item.label}</span>
				</Link>
			))}
		</nav>
	);
}
