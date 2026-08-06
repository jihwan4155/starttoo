import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import ArtistBadge from "../common/ArtistBadge";
import StarttooLoader from "../loader/StarttooLoader";
import useFollowList, {
	type FollowListKind,
} from "../../hooks/queries/useFollowList";
import { ApiError } from "../../services/api";
import { profilePath, resolveAvatar } from "../../utils/profile";

const TABS: { kind: FollowListKind; label: string }[] = [
	{ kind: "followers", label: "팔로워" },
	{ kind: "following", label: "팔로우" },
];

const EMPTY_MESSAGE: Record<FollowListKind, string> = {
	followers: "아직 팔로워가 없습니다",
	following: "아직 팔로우한 사용자가 없습니다",
};

type FollowListModalProps = {
	isOpen: boolean;
	/** 목록을 볼 대상 회원 */
	userId: number;
	/** 열릴 때 선택되는 탭 */
	kind: FollowListKind;
	onChangeKind: (kind: FollowListKind) => void;
	onClose: () => void;
};

/** 팔로워·팔로우 목록 — GET /users/{userId}/followers · /following */
export default function FollowListModal({
	isOpen,
	userId,
	kind,
	onChangeKind,
	onClose,
}: FollowListModalProps) {
	const {
		data,
		isPending,
		isError,
		error,
		hasNextPage,
		fetchNextPage,
		isFetchingNextPage,
	} = useFollowList({ userId, kind, enabled: isOpen });

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

	const navigate = useNavigate();

	if (!isOpen) return null;

	const errorMessage =
		error instanceof ApiError ? error.message : "목록을 불러오지 못했습니다.";

	const handleSelect = (targetUserId: number) => {
		onClose();
		navigate(profilePath(targetUserId));
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
				aria-label="팔로워·팔로우 목록">
				<div className="relative flex shrink-0 border-b border-black/10">
					{TABS.map((tab) => (
						<button
							key={tab.kind}
							type="button"
							onClick={() => onChangeKind(tab.kind)}
							className={`flex-1 py-4 text-[15px] transition ${
								tab.kind === kind
									? "border-b-2 border-black font-bold text-black"
									: "font-light text-black/45 hover:text-black/70"
							}`}>
							{tab.label}
						</button>
					))}
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
							{EMPTY_MESSAGE[kind]}
						</p>
					) : (
						<ul>
							{users.map((user) => (
								<li key={user.userId}>
									<button
										type="button"
										onClick={() => handleSelect(user.userId)}
										className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition hover:bg-black/[0.04]">
										<img
											src={resolveAvatar(user.profileImageUrl, user.nickname)}
											alt=""
											className="size-11 shrink-0 rounded-full bg-[#D9D9D9] object-cover"
										/>
										<span className="flex min-w-0 items-center gap-1.5">
											<span className="truncate text-[15px] font-semibold text-black">
												{user.nickname}
											</span>
											{/* role만 보면 심사 전 계정에도 뱃지가 붙어 verified를 본다 */}
										{user.isVerifiedArtist && <ArtistBadge size={15} />}
										</span>
									</button>
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
							{isFetchingNextPage ? "불러오는 중…" : "더 보기"}
						</button>
					)}
				</div>
			</div>
		</div>,
		document.body,
	);
}
