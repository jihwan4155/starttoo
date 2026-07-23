import type { ReactNode } from "react";

type ActionButtonProps = {
	children: ReactNode;
	onClick?: () => void;
	variant?: "primary" | "outline";
	disabled?: boolean;
	className?: string;
};

export default function ActionButton({
	children,
	onClick,
	variant = "primary",
	disabled = false,
	className = "",
}: ActionButtonProps) {
	const variantClass =
		variant === "primary"
			? "bg-brand text-white hover:brightness-95"
			: "border border-black/20 bg-white text-black hover:bg-black/5";

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`inline-flex h-[46px] items-center justify-center gap-1.5 rounded-full px-7 text-[15px] font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${variantClass} ${className}`}>
			{children}
		</button>
	);
}
