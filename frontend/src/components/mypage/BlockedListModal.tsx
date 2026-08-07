import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import ArtistBadge from "../common/ArtistBadge";
import StarttooLoader from "../loader/StarttooLoader";
import useBlockedUsers from "../../hooks/queries/useBlockedUsers";
import useBlockUser from "../../hooks/mutations/useBlockUser";
import useBackClose from "../../hooks/useBackClose";
import { ApiError } from "../../services/api";
import { resolveAvatar } from "../../utils/profile";
import LoadingLabel from "../loader/LoadingLabel";

type BlockedListModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

/**
 * 차단 목록 — GET /users/me/blocks
 *
 * 차단한 회원의 프로필은 서버가 USER_NOT_FOUND로 막아 그쪽에서는 해제할 수 없다.
 * 그래서 이름을 눌러도 프로필로 보내지 않고, 해제만 여기서 처리한다.
 */
export default function BlockedListModal({
	isOpen,
	onClose,
}: BlockedListModalProps) {
	const {
		data,
		isPending,
		isError,
		error,
		hasNextPage,
		fetchNextPage,
		isFetchingNextPage,
	} = useBlockedUsers({ enabled: isOpen });
	const { mutate: setBlock, isPending: isUnblocking, variables } = useBlockUser();

	const users = useMemo(
		() => data?.pages.flatMap((page) => page.items) ?? [],
		[data?.pages],
	);

	// 열려 있는 동안 Esc로 닫고 배경 스크롤을 막는다.
	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, onClose]);

	// 뒤로가기는 페이지를 떠나는 대신 이 창만 닫는다
	useBackClose(isOpen, onClose);

	if (!isOpen) return null;

	const errorMessage =
		error instanceof ApiError
			? error.message
			: "차단 목록을 불러오지 못했습니다.";

	const handleUnblock = (userId: number, nickname: string) => {
		// 해제해도 끊긴 팔로우는 돌아오지 않아 되돌리기 어려운 동작이다.
		const confirmed = window.confirm(
			`${nickname}님의 차단을 해제하시겠습니까?\n` +
				"차단하면서 끊긴 팔로우는 복구되지 않습니다.",
		);
		if (!confirmed) return;
		setBlock(
			{ userId, blocked: false },
			{
				onError: (err) => {
					window.alert(
						err instanceof ApiError
							? err.message
							: "차단을 해제하지 못했습니다.",
					);
				},
			},
		);
	};

	return createPortal(
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-[2px]"
			onClick={onClose}
			role="presentation">
			<div
				className="flex max-h-[70vh] w-full max-w-[400px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="차단 목록">
				<div className="relative flex shrink-0 items-center justify-center border-b border-black/10 py-4">
					<p className="text-[15px] font-bold text-black">차단 목록</p>
					<button
						type="button"
						aria-label="닫기"
						onClick={onClose}
						className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-black/40 transition hover:bg-black/5 hover:text-black">
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
							strokeLinecap="round">
							<path d="M5 5l14 14M19 5L5 19" />
						</svg>
					</button>
				</div>

				<div className="min-h-[220px] flex-1 overflow-y-auto px-2 py-2">
					{isPending ? (
						<StarttooLoader variant="block" size={140} />
					) : isError ? (
						<p className="py-16 text-center text-[14px] font-light text-black/50">
							{errorMessage}
						</p>
					) : users.length === 0 ? (
						<p className="py-16 text-center text-[14px] font-light text-black/45">
							차단한 사용자가 없습니다
						</p>
					) : (
						<ul>
							{users.map((user) => (
								<li key={user.userId}>
									<div className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5">
										<img
											src={resolveAvatar(user.profileImageUrl, user.nickname)}
											alt=""
											className="size-11 shrink-0 rounded-full bg-[#D9D9D9] object-cover"
										/>
										<span className="flex min-w-0 flex-1 items-center gap-1.5">
											<span className="truncate text-[15px] font-semibold text-black">
												{user.nickname}
											</span>
											{user.isVerifiedArtist && <ArtistBadge size={15} />}
										</span>
										<button
											type="button"
											onClick={() => handleUnblock(user.userId, user.nickname)}
											disabled={isUnblocking && variables?.userId === user.userId}
											className="shrink-0 rounded-full border border-black/20 px-3.5 py-1.5 text-[12px] font-semibold text-black/70 transition hover:border-black/35 hover:bg-black/5 hover:text-black disabled:opacity-50">
											{isUnblocking && variables?.userId === user.userId
												? "해제 중…"
												: "차단 해제"}
										</button>
									</div>
								</li>
							))}
						</ul>
					)}

					{hasNextPage && (
						<button
							type="button"
							onClick={() => fetchNextPage()}
							disabled={isFetchingNextPage}
							className="mt-1 w-full rounded-[12px] py-3 text-[13px] font-semibold text-black/50 transition hover:bg-black/[0.04] disabled:opacity-50">
							{isFetchingNextPage ? <LoadingLabel>불러오는 중…</LoadingLabel> : "더 보기"}
						</button>
					)}
				</div>
			</div>
		</div>,
		document.body,
	);
}
