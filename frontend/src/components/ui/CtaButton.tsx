import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type CtaButtonProps = {
	/** 문구만 넣던 자리인데, 대기 상태에서 로더를 앞에 붙이려고 노드까지 받는다 */
	children: ReactNode;
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
	const sharedClassName = `inline-flex h-11 w-full max-w-[360px] shrink-0 items-center justify-center whitespace-nowrap rounded-[50px] bg-brand px-6 text-[15px] font-semibold leading-5 text-white transition hover:brightness-95 active:scale-[0.99] lg:h-[66px] lg:w-[360px] lg:px-8 lg:text-[30px] lg:leading-[35px] ${className}`;

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
