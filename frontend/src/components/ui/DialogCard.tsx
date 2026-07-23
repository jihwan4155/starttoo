import type { ReactNode } from "react";

type DialogCardProps = {
	title?: string;
	onClose: () => void;
	children: ReactNode;
};

export default function DialogCard({
	title,
	onClose,
	children,
}: DialogCardProps) {
	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
			<div className="relative w-full max-w-[560px] rounded-[16px] bg-white p-8">
				<button
					type="button"
					onClick={onClose}
					aria-label="닫기"
					className="absolute right-6 top-6 text-[22px] leading-none text-black/60 transition hover:text-black">
					✕
				</button>
				{title && <h3 className="text-[20px] font-bold text-black">{title}</h3>}
				<div className={title ? "mt-6" : ""}>{children}</div>
			</div>
		</div>
	);
}
