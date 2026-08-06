import { useEffect, useRef, useState } from "react";
import { MoreIcon } from "../community/icons";
import useBlockUser from "../../hooks/mutations/useBlockUser";
import useRequireAuth from "../../hooks/useRequireAuth";
import { ApiError } from "../../services/api";

type ProfileMoreMenuProps = {
	userId: number;
	nickname: string;
	/** 차단 성공 후 — 이 프로필은 더 볼 수 없으므로 호출부가 화면을 옮긴다 */
	onBlocked: () => void;
};

/**
 * 상대 프로필의 더보기 메뉴 — PUT /users/{userSeq}/block
 *
 * 차단은 서로의 팔로우를 끊고 상대 프로필·DM을 막는 되돌리기 어려운 동작이라
 * 한 번 확인을 받는다. 해제는 이 화면에서 할 수 없다 — 차단하면 서버가 프로필
 * 조회를 USER_NOT_FOUND로 막아 여기로 다시 들어올 수 없기 때문이다.
 */
export default function ProfileMoreMenu({
	userId,
	nickname,
	onBlocked,
}: ProfileMoreMenuProps) {
	const [isOpen, setOpen] = useState(false);
	const wrapRef = useRef<HTMLDivElement>(null);
	const { requireAuth } = useRequireAuth();
	const { mutate: block, isPending: isBlocking } = useBlockUser();

	useEffect(() => {
		if (!isOpen) return undefined;
		const onPointerDown = (e: MouseEvent) => {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", onPointerDown);
		return () => document.removeEventListener("mousedown", onPointerDown);
	}, [isOpen]);

	const handleBlock = () => {
		requireAuth(() => {
			const confirmed = window.confirm(
				`${nickname}님을 차단하시겠습니까?\n` +
					"서로의 팔로우가 해제되고 이 프로필과 대화를 볼 수 없게 됩니다.",
			);
			if (!confirmed) return;
			block(
				{ userId, blocked: true },
				{
					onSuccess: () => {
						setOpen(false);
						onBlocked();
					},
					onError: (err) => {
						window.alert(
							err instanceof ApiError ? err.message : "차단하지 못했습니다.",
						);
					},
				},
			);
		});
	};

	return (
		<div ref={wrapRef} className="relative">
			<button
				type="button"
				aria-label={`${nickname} 프로필 메뉴`}
				aria-expanded={isOpen}
				onClick={() => setOpen((prev) => !prev)}
				className="flex size-9 items-center justify-center rounded-full text-black/60 transition hover:bg-black/5 hover:text-black">
				<MoreIcon size={20} />
			</button>

			{isOpen && (
				<div className="absolute right-0 top-full z-20 mt-2 w-[160px] overflow-hidden rounded-[12px] border border-black/10 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.10)]">
					<button
						type="button"
						onClick={handleBlock}
						disabled={isBlocking}
						className="block w-full px-4 py-3 text-left text-[13px] text-red-600 transition hover:bg-red-50 disabled:opacity-50">
						{isBlocking ? "차단하는 중…" : "차단하기"}
					</button>
				</div>
			)}
		</div>
	);
}
