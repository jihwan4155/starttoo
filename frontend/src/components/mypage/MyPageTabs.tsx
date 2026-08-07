export type MyPageTab = "feed" | "designs" | "bookmarks" | "collection";

type MyPageTabsProps = {
	active: MyPageTab;
	onChange: (tab: MyPageTab) => void;
	/** 도안 추출 창 열기 */
	onOpenExtract: () => void;
};

const TABS: { id: MyPageTab; label: string }[] = [
	{ id: "feed", label: "내 피드" },
	{ id: "designs", label: "도안 보관함" },
	{ id: "bookmarks", label: "북마크한 게시글" },
	{ id: "collection", label: "내 컬렉션" },
];

export default function MyPageTabs({
	active,
	onChange,
	onOpenExtract,
}: MyPageTabsProps) {
	return (
		<div className="grid grid-cols-5 border-b border-black/10 lg:flex lg:gap-4">
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

			{/*
			 * 탭이 아니라 창을 여는 동작이라 색으로 구분하고 오른쪽 끝에 둔다.
			 * 넓은 화면은 ml-auto로 밀고, 좁은 화면은 탭과 같은 격자의 마지막 칸에 놓인다.
			 */}
			<button
				type="button"
				onClick={onOpenExtract}
				className="-mb-px flex items-center justify-center whitespace-nowrap border-b-2 border-transparent px-1 pb-2.5 text-[12px] font-semibold text-brand transition hover:brightness-90 lg:ml-auto lg:px-3 lg:pb-3 lg:text-[15px]">
				도안 추출
			</button>
		</div>
	);
}
