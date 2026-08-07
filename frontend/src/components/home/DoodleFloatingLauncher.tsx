import { useState } from "react";
import DoodleModal from "./DoodleModal";

function DoodleFabIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
			<path
				d="M12 19l7-7 3 3-7 7-3-3z"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinejoin="round"
			/>
			<path
				d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/** 홈 우하단 — 낙서장 모달 열기 (데스크톱만) */
export default function DoodleFloatingLauncher() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button
				type="button"
				aria-label="낙서장 열기"
				onClick={() => setOpen(true)}
				className="fixed bottom-8 right-8 z-[55] hidden size-14 items-center justify-center rounded-[12px] border-2 border-black bg-white text-black shadow-[0_6px_20px_rgba(0,0,0,0.12)] transition hover:bg-black/[0.03] active:scale-[0.97] lg:flex">
				<DoodleFabIcon />
			</button>
			<DoodleModal isOpen={open} onClose={() => setOpen(false)} />
		</>
	);
}
