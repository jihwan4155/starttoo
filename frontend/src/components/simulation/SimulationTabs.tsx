export type SimulationTab = "ar" | "image";

type SimulationTabsProps = {
	active: SimulationTab;
	onChange: (tab: SimulationTab) => void;
};

const TABS: { id: SimulationTab; label: string }[] = [
	{ id: "image", label: "이미지 (3D)" },
	{ id: "ar", label: "실시간 (AR)" },
];

export default function SimulationTabs({
	active,
	onChange,
}: SimulationTabsProps) {
	return (
		<div className="mx-auto flex h-[52px] w-full max-w-[550px] items-center rounded-[16px] bg-white p-1 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
			{TABS.map((tab) => (
				<button
					key={tab.id}
					type="button"
					onClick={() => onChange(tab.id)}
					className={`h-full flex-1 rounded-[12px] text-[16px] font-semibold transition ${
						active === tab.id ? "bg-surface text-black" : "text-black/40"
					}`}>
					{tab.label}
				</button>
			))}
		</div>
	);
}
