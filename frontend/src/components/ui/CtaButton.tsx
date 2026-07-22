type CtaButtonProps = {
	children: string;
	onClick?: () => void;
	className?: string;
};

export default function CtaButton({
	children,
	onClick,
	className = "",
}: CtaButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`inline-flex h-[66px] min-w-[276px] items-center justify-center rounded-[50px] bg-brand px-8 text-[30px] font-semibold leading-[35px] text-white transition hover:brightness-95 active:scale-[0.99] ${className}`}>
			{children}
		</button>
	);
}
