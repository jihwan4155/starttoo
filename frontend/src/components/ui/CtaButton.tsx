import { Link } from "react-router-dom";

type CtaButtonProps = {
	children: string;
	to?: string;
	onClick?: () => void;
	/** to 없이 버튼으로 쓸 때만 적용된다 */
	disabled?: boolean;
	className?: string;
};

export default function CtaButton({
	children,
	to,
	onClick,
	disabled = false,
	className = "",
}: CtaButtonProps) {
	const sharedClassName = `inline-flex h-[66px] w-[360px] shrink-0 items-center justify-center whitespace-nowrap rounded-[50px] bg-brand px-8 text-[30px] font-semibold leading-[35px] text-white transition hover:brightness-95 active:scale-[0.99] ${className}`;

	if (to) {
		return (
			<Link to={to} className={sharedClassName}>
				{children}
			</Link>
		);
	}

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`${sharedClassName} disabled:opacity-50`}>
			{children}
		</button>
	);
}
