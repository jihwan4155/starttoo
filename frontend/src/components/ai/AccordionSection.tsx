type AccordionSectionProps = {
	title: string;
	isOpen: boolean;
	onToggle: () => void;
	children: React.ReactNode;
};

function ChevronIcon({ open }: { open: boolean }) {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden
			className={`transition-transform ${open ? "rotate-180" : ""}`}>
			<path
				d="M6 9l6 6 6-6"
				stroke="#1A1A1A"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export default function AccordionSection({
	title,
	isOpen,
	onToggle,
	children,
}: AccordionSectionProps) {
	return (
		<section className="rounded-[10px] border border-[#E8E8E8] bg-white">
			<button
				type="button"
				onClick={onToggle}
				className="flex w-full items-center justify-between bg-[#F5F5F5] px-8 py-5 text-left">
				<span className="text-[20px] font-semibold leading-6 text-black">{title}</span>
				<ChevronIcon open={isOpen} />
			</button>
			{isOpen && <div className="border-t border-[#E8E8E8]">{children}</div>}
		</section>
	);
}
