export type MyPageTab = "feed" | "designs" | "bookmarks" | "collection";

type MyPageTabsProps = {
	active: MyPageTab;
	onChange: (tab: MyPageTab) => void;
};

const TABS: { id: MyPageTab; label: string }[] = [
	{ id: "feed", label: "내 피드" },
	{ id: "designs", label: "도안 보관함" },
	{ id: "bookmarks", label: "북마크한 게시글" },
	{ id: "collection", label: "내 컬렉션" },
];

export default function MyPageTabs({ active, onChange }: MyPageTabsProps) {
	return (
		<div className="grid grid-cols-4 border-b border-black/10 lg:flex lg:gap-4">
			{TABS.map((tab) => (
				<button
					key={tab.id}
					type="button"
					onClick={() => onChange(tab.id)}
					aria-current={active === tab.id ? "true" : undefined}
					className={`-mb-px whitespace-nowrap border-b-2 px-1 pb-2.5 text-[12px] transition lg:px-3 lg:pb-3 lg:text-[15px] ${
						active === tab.id
							? "border-black font-semibold text-black"
							: "border-transparent font-light text-black/40 hover:text-black/60"
					}`}>
					{tab.label}
				</button>
			))}
		</div>
	);
}
