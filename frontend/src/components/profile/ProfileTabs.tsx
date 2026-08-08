export type ProfileTab = "feed" | "collection";

type ProfileTabsProps = {
	active: ProfileTab;
	onChange: (tab: ProfileTab) => void;
};

const TABS: { id: ProfileTab; label: string }[] = [
	{ id: "feed", label: "게시물" },
	{ id: "collection", label: "컬렉션" },
];

/** 상대 프로필 탭 — 피드 / 컬렉션 */
export default function ProfileTabs({ active, onChange }: ProfileTabsProps) {
	return (
		// 모바일은 탭을 화면 폭에 반씩 나눠 가운데 정렬한다. 좁은 화면에서 왼쪽에만
		// 몰려 보이던 문제 때문 (마이페이지 탭과 같은 방식).
		<div className="grid grid-cols-2 border-b border-black/10 lg:flex lg:gap-4">
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
