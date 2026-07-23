import { Link } from "react-router-dom";

type CtaButtonProps = {
	children: string;
	to?: string;
	onClick?: () => void;
	className?: string;
};

export default function CtaButton({
	children,
	to,
	onClick,
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
		<button type="button" onClick={onClick} className={sharedClassName}>
			{children}
		</button>
	);
}
