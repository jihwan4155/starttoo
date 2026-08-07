import { useEffect, useRef, useState } from "react";
import { MoreIcon } from "../community/icons";

type MyPageMoreMenuProps = {
	onOpenBlockedList: () => void;
};

/** 마이페이지 더보기 메뉴 — 지금은 차단 목록만 들어 있다 */
export default function MyPageMoreMenu({
	onOpenBlockedList,
}: MyPageMoreMenuProps) {
	const [isOpen, setOpen] = useState(false);
	const wrapRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) return undefined;
		const onPointerDown = (e: MouseEvent) => {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [isOpen]);

	return (
		<div ref={wrapRef} className="relative">
			<button
				type="button"
				aria-label="더보기"
				aria-expanded={isOpen}
				onClick={() => setOpen((prev) => !prev)}
				className="flex size-8 items-center justify-center rounded-full text-black/55 transition hover:bg-black/5 hover:text-black">
				<MoreIcon size={20} />
			</button>

			{isOpen && (
				<div className="absolute right-0 top-full z-30 mt-2 w-[150px] overflow-hidden rounded-[12px] border border-black/10 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.10)]">
					<button
						type="button"
						onClick={() => {
							setOpen(false);
							onOpenBlockedList();
						}}
						className="block w-full px-4 py-3 text-left text-[13px] font-semibold text-black transition hover:bg-black/[0.04]">
						차단 목록
					</button>
				</div>
			)}
		</div>
	);
}
