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
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-3 sm:px-4">
			<div className="relative w-full max-w-[560px] rounded-[16px] bg-white p-4 pt-12 sm:p-8">
				<button
					type="button"
					onClick={onClose}
					aria-label="닫기"
					className="absolute right-4 top-4 text-[22px] leading-none text-black/60 transition hover:text-black sm:right-6 sm:top-6">
					✕
				</button>
				{title && <h3 className="text-[18px] font-bold text-black sm:text-[20px]">{title}</h3>}
				<div className={title ? "mt-4 sm:mt-6" : ""}>{children}</div>
			</div>
		</div>
	);
}
