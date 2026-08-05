import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, SearchIcon } from "./icons";
import StarttooLoader from "../loader/StarttooLoader";
import useFollowList from "../../hooks/queries/useFollowList";
import { ApiError } from "../../services/api";
import { createDmRoom, sendDmMessage } from "../../services/dmApi";
import useAuthStore from "../../store/useAuthStore";
import useToastStore from "../../store/useToastStore";
import type { Post } from "../../types/community";
import { shareMessageText } from "../../utils/sharePost";
import { resolveAvatar } from "../../utils/profile";

type SharePostModalProps = {
	/** null이면 닫힌 상태 — 상세·카드 양쪽에서 같은 방식으로 연다 */
	post: Post | null;
	onClose: () => void;
};

/**
 * 게시글을 DM으로 보내는 친구 선택 모달.
 *
 * 받는 사람 후보는 내 팔로잉 목록이다. 닉네임 검색 API(GET /search/accounts)를
 * 쓰지 않고 받아온 목록을 그 자리에서 거른다 — 서버 검색 인덱스가 비어 있어
 * 어떤 닉네임을 넣어도 결과가 없기 때문이다. 목록이 50명을 넘으면 그때
 * 서버 검색으로 바꾸는 편이 낫다.
 *
 * DM 메시지 타입은 TEXT·IMAGE뿐이라 게시글을 첨부할 방법이 없다. 그래서
 * 게시글 주소를 본문에 담아 보내고, 받는 쪽은 /posts/:postId 로 열어 본다.
 */
export default function SharePostModal({ post, onClose }: SharePostModalProps) {
	const myUserId = useAuthStore((s) => s.user?.userId);
	const showToast = useToastStore((s) => s.showToast);

	const [keyword, setKeyword] = useState("");
	const [selected, setSelected] = useState<number[]>([]);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// 서버 최대 50 — 한 번에 받아 두고 아래에서 닉네임으로 거른다.
	const { data, isPending, isError } = useFollowList({
		userId: myUserId ?? 0,
		kind: "following",
		enabled: post != null,
		size: 50,
	});

	const candidates = useMemo(() => {
		const items = data?.pages.flatMap((page) => page.items) ?? [];
		const trimmed = keyword.trim().toLowerCase();
		if (!trimmed) return items;
		return items.filter((user) =>
			user.nickname.toLowerCase().includes(trimmed),
		);
	}, [data?.pages, keyword]);

	if (!post) return null;

	const close = () => {
		setKeyword("");
		setSelected([]);
		setError(null);
		onClose();
	};

	const toggle = (userId: number) => {
		setError(null);
		setSelected((current) =>
			current.includes(userId)
				? current.filter((id) => id !== userId)
				: [...current, userId],
		);
	};

	const handleSend = async () => {
		if (selected.length === 0 || sending) return;
		setError(null);
		setSending(true);
		try {
			const text = shareMessageText(post);
			// 방 생성은 상대별로 따로 필요하고, 이미 있으면 서버가 그 방을 돌려준다.
			// 한 명이라도 실패하면 어디까지 갔는지 알려야 하므로 순서대로 보낸다.
			for (const partnerSeq of selected) {
				const room = await createDmRoom(partnerSeq);
				await sendDmMessage(room.dmRoomSeq, { textContent: text });
			}
			showToast(
				selected.length === 1
					? "게시글을 보냈습니다."
					: `${selected.length}명에게 게시글을 보냈습니다.`,
			);
			close();
		} catch (cause) {
			setError(
				cause instanceof ApiError
					? cause.message
					: "게시글을 보내지 못했습니다.",
			);
		} finally {
			setSending(false);
		}
	};

	return createPortal(
		<div
			className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
			onClick={close}>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="게시글 공유"
				onClick={(event) => event.stopPropagation()}
				className="flex max-h-[80vh] w-full max-w-[420px] flex-col overflow-hidden rounded-[16px] bg-white shadow-xl">
				<div className="relative shrink-0 border-b border-black/10 px-5 py-4">
					<h2 className="text-center text-[16px] font-bold text-black">
						새 메시지
					</h2>
					<button
						type="button"
						aria-label="닫기"
						onClick={close}
						className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-black/50 transition hover:text-black">
						<CloseIcon size={18} />
					</button>
				</div>

				<div className="shrink-0 px-5 py-3">
					<div className="flex items-center gap-2">
						<span className="shrink-0 text-[14px] font-semibold text-black">
							받는 사람
						</span>
						<div className="flex min-w-0 flex-1 items-center gap-2 border-b border-black/15 pb-1">
							<SearchIcon size={15} className="shrink-0 text-black/35" />
							<input
								value={keyword}
								onChange={(event) => setKeyword(event.target.value)}
								placeholder="검색…"
								maxLength={20}
								aria-label="받는 사람 검색"
								className="min-w-0 flex-1 bg-transparent text-[14px] font-light text-black outline-none placeholder:text-black/35"
							/>
						</div>
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
					{/*
					  내 userSeq는 GET /users/me가 채워 준다. 그 전이면 쿼리가 꺼져 있어
					  isPending이 계속 true라, 로더를 그대로 두면 영원히 돈다.
					*/}
					{myUserId == null && (
						<p className="px-3 py-10 text-center text-[13px] font-light text-black/40">
							내 정보를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.
						</p>
					)}

					{myUserId != null && isPending && (
						<div className="py-10">
							<StarttooLoader variant="block" label="불러오는 중…" />
						</div>
					)}

					{myUserId != null && !isPending && isError && (
						<p className="px-3 py-10 text-center text-[13px] text-brand">
							목록을 불러오지 못했습니다.
						</p>
					)}

					{myUserId != null && !isPending && !isError && candidates.length === 0 && (
						<p className="px-3 py-10 text-center text-[13px] font-light leading-5 text-black/40">
							{keyword.trim()
								? "검색 결과가 없습니다."
								: "팔로우한 친구가 없어요. 먼저 친구를 팔로우해 보세요."}
						</p>
					)}

					<ul className="flex flex-col">
						{candidates.map((user) => {
							const checked = selected.includes(user.userId);
							return (
								<li key={user.userId}>
									<button
										type="button"
										onClick={() => toggle(user.userId)}
										aria-pressed={checked}
										className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left transition hover:bg-black/5">
										<img
											src={resolveAvatar(user.profileImageUrl, user.nickname)}
											alt=""
											className="size-10 shrink-0 rounded-full bg-[#D9D9D9] object-cover"
										/>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-[14px] font-semibold text-black">
												{user.nickname}
											</span>
										</span>
										{/* 체크 표시는 원 안을 채워서 낸다 — 아이콘을 새로 들이지 않는다 */}
										<span
											aria-hidden
											className={`flex size-[22px] shrink-0 items-center justify-center rounded-full border transition ${
												checked
													? "border-brand bg-brand"
													: "border-black/25 bg-white"
											}`}>
											{checked && (
												<span className="size-[9px] rounded-full bg-white" />
											)}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				</div>

				<div className="shrink-0 border-t border-black/10 px-5 py-4">
					{error && (
						<p role="alert" className="mb-3 text-[13px] text-brand">
							{error}
						</p>
					)}
					<button
						type="button"
						onClick={() => void handleSend()}
						disabled={selected.length === 0 || sending}
						className="h-[46px] w-full rounded-full bg-brand text-[15px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#FFB4B4]">
						{sending
							? "보내는 중…"
							: selected.length > 1
								? `${selected.length}명에게 보내기`
								: "보내기"}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
