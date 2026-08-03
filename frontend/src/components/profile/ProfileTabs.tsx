export type ProfileTab = "feed" | "collection";

type ProfileTabsProps = {
	active: ProfileTab;
	onChange: (tab: ProfileTab) => void;
};

const TABS: { id: ProfileTab; label: string }[] = [
	{ id: "feed", label: "피드" },
	{ id: "collection", label: "컬렉션" },
];

/** 상대 프로필 탭 — 피드 / 컬렉션 */
export default function ProfileTabs({ active, onChange }: ProfileTabsProps) {
	return (
		<div className="flex gap-4 border-b border-black/10">
			{TABS.map((tab) => (
				<button
					key={tab.id}
					type="button"
					onClick={() => onChange(tab.id)}
					aria-current={active === tab.id ? "true" : undefined}
					className={`-mb-px border-b-2 px-3 pb-3 text-[15px] transition ${
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
