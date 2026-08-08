import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ArtistBadge from "../components/common/ArtistBadge";
import { MoreIcon, SearchIcon, ShareIcon } from "../components/community/icons";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../constants/upload";
import DmRoomMenu from "../components/dm/DmRoomMenu";
import MessageBubble from "../components/dm/MessageBubble";
import StarttooLoader from "../components/loader/StarttooLoader";
import { formatDmDateLabel } from "../components/dm/dmTime";
import {
	useCreateDmRoom,
	useMarkDmRoomRead,
	useSendDmMessage,
} from "../hooks/mutations/useDmMutations";
import useDmMessages from "../hooks/queries/useDmMessages";
import useDmRooms from "../hooks/queries/useDmRooms";
import useFollowList from "../hooks/queries/useFollowList";
import useMe from "../hooks/queries/useMe";
import useAuthStore from "../store/useAuthStore";
import useDmStore from "../store/useDmStore";
import useUserStore from "../store/useUserStore";
import { ApiError } from "../services/api";
import type { DmMessageResponse } from "../types/dm";
import { profilePath, resolveAvatar } from "../utils/profile";
import { dmPreviewText } from "../utils/sharePost";
import { formatDmTime } from "../components/dm/dmTime";
import LoadingLabel from "../components/loader/LoadingLabel";

function BackIcon() {
	return (
		<svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
			<path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function ImageAttachIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinejoin="round"
			aria-hidden>
			<rect x="3" y="4.5" width="18" height="15" rx="2.5" />
			<circle cx="8.5" cy="9.5" r="1.6" />
			<path d="M4 17l4.8-4.8 3.4 3.4 2.6-2.6L20 18" />
		</svg>
	);
}

/** 목록 우측의 마지막 메시지 시각 — 오늘이면 시각, 아니면 날짜 */
function formatRoomTime(iso: string | null): string {
	if (!iso) return "";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	const now = new Date();
	const sameDay =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();
	return sameDay
		? formatDmTime(iso)
		: `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** DM — 채팅방 목록 + 대화창 */
export default function DmPage() {
	const accessToken = useAuthStore((s) => s.accessToken);
	const activeRoomSeq = useDmStore((s) => s.activeRoomSeq);
	const openRoom = useDmStore((s) => s.openRoom);
	const leaveDm = useDmStore((s) => s.leaveDm);
	const myNickname = useUserStore((s) => s.nickname);
	const { data: me } = useMe();
	const myUserSeq = me?.userId ?? null;

	const [searchParams, setSearchParams] = useSearchParams();
	const [input, setInput] = useState("");
	const [search, setSearch] = useState("");
	const [searchError, setSearchError] = useState<string | null>(null);
	const [sendError, setSendError] = useState<string | null>(null);
	const [image, setImage] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const imageInputRef = useRef<HTMLInputElement>(null);

	const {
		data: roomsData,
		isPending: isRoomsPending,
		isError: isRoomsError,
		error: roomsError,
		hasNextPage: hasMoreRooms,
		fetchNextPage: fetchMoreRooms,
		isFetchingNextPage: isFetchingMoreRooms,
	} = useDmRooms({ size: 30 });

	const rooms = useMemo(
		() => roomsData?.pages.flatMap((page) => page.items) ?? [],
		[roomsData?.pages],
	);
	const selectedRoom =
		rooms.find((room) => room.dmRoomSeq === activeRoomSeq) ?? null;

	const {
		data: messagesData,
		isPending: isMessagesPending,
		isError: isMessagesError,
		error: messagesError,
		hasNextPage: hasOlderMessages,
		fetchNextPage: fetchOlderMessages,
		isFetchingNextPage: isFetchingOlder,
	} = useDmMessages(activeRoomSeq, { size: 50 });

	// 서버는 최신부터 내려준다 — 시간순으로 뒤집어 그린다.
	const messages = useMemo(() => {
		const flat = messagesData?.pages.flatMap((page) => page.items) ?? [];
		return [...flat].reverse();
	}, [messagesData?.pages]);

	const { mutate: markRead } = useMarkDmRoomRead();
	const { mutateAsync: sendMessage, isPending: isSending } = useSendDmMessage();
	const { mutate: createRoom, isPending: isCreatingRoom } = useCreateDmRoom();

	/*
	 * 대화 상대 찾기 — 후보는 내가 팔로우한 사람이다.
	 *
	 * 닉네임 검색 API(GET /search/accounts) 대신 팔로잉 목록을 받아 그 자리에서
	 * 거른다. 공유 모달(SharePostModal)이 쓰는 방식과 같다. 검색어를 입력할 때만
	 * 목록을 받아 DM 화면을 열기만 한 사람에게는 요청이 나가지 않는다.
	 */
	const keyword = search.trim();
	const { data: followingData, isPending: isFollowingPending } = useFollowList({
		userId: myUserSeq ?? 0,
		kind: "following",
		enabled: keyword.length > 0 && myUserSeq != null,
		size: 50,
	});

	const searchResults = useMemo(() => {
		if (!keyword) return [];
		const lowered = keyword.toLowerCase();
		return (followingData?.pages.flatMap((page) => page.items) ?? []).filter(
			(user) => user.nickname.toLowerCase().includes(lowered),
		);
	}, [followingData?.pages, keyword]);

	// DM 페이지를 벗어나면 선택 해제 (이후 수신 메시지는 알림으로 표시)
	useEffect(() => () => leaveDm(), [leaveDm]);

	/*
	 * 보고 있던 방을 주소(?room=)에 실어 둔다.
	 *
	 * activeRoomSeq는 "지금 이 방을 보고 있는지"라 페이지를 벗어날 때 비워야 한다
	 * (안 그러면 그 방 메시지가 알림으로 안 뜬다). 그래서 공유된 게시물을 열었다
	 * 돌아오면 선택이 사라져 목록부터 다시 시작했다. 주소에 남겨 두면 히스토리
	 * 항목이 그 방을 기억하므로, 뒤로가기·상세 닫기 어느 쪽으로 돌아와도 보던
	 * 대화가 그대로 열린다. 지우는 쪽은 아래 closeRoom이 직접 한다.
	 */
	useEffect(() => {
		if (activeRoomSeq == null) return;
		if (searchParams.get("room") === String(activeRoomSeq)) return;
		const next = new URLSearchParams(searchParams);
		next.set("room", String(activeRoomSeq));
		setSearchParams(next, { replace: true });
	}, [activeRoomSeq, searchParams, setSearchParams]);

	// 주소에 남아 있던 방을 한 번만 되살린다 (알림으로 들어온 선택이 있으면 그쪽이 우선)
	useEffect(() => {
		if (activeRoomSeq != null) return;
		const seq = Number(searchParams.get("room"));
		if (Number.isInteger(seq) && seq > 0) openRoom(seq);
		// 마운트 시 1회 — 이후 방 전환은 handleOpenRoom·closeRoom이 맡는다
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	/** 대화창을 닫고 목록으로 — 주소에 남은 방도 함께 지운다 */
	const closeRoom = () => {
		leaveDm();
		const next = new URLSearchParams(searchParams);
		next.delete("room");
		setSearchParams(next, { replace: true });
	};

	/*
	 * 읽음 처리는 기본적으로 서버가 메시지 조회에서 함께 한다. 열어 둔 방은 새
	 * 메시지마다 어차피 메시지를 다시 받으므로, 그것만으로 안읽음이 따라 내려간다.
	 *
	 * 여기 남은 건 그 조회가 일어나지 않는 경우를 위한 안전망이다. 메시지 쿼리는
	 * staleTime이 있어서 방을 닫았다 곧바로 다시 열면 캐시로 그려지고 요청이
	 * 나가지 않는다. 그때는 안읽음이 남아 있을 수 있으니 직접 한 번 처리한다.
	 * 0이면 요청하지 않으므로 평소에는 나가지 않는다.
	 */
	const activeUnreadCount = selectedRoom?.unreadCount ?? 0;
	useEffect(() => {
		if (activeRoomSeq == null || activeUnreadCount === 0) return;
		markRead(activeRoomSeq);
	}, [activeRoomSeq, activeUnreadCount, markRead]);

	// 방 전환·새 메시지 시 맨 아래로. 과거 메시지를 더 불러온 경우는 제외한다.
	useEffect(() => {
		if (isFetchingOlder) return;
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [activeRoomSeq, messages.length, isFetchingOlder]);

	const clearImage = () => {
		setImage(null);
		setImagePreview((prev) => {
			if (prev) URL.revokeObjectURL(prev);
			return null;
		});
	};

	const handleOpenRoom = (roomSeq: number) => {
		openRoom(roomSeq);
		setInput("");
		setSendError(null);
		clearImage();
	};

	/**
	 * 검색 결과에서 고른 사람과의 방을 연다.
	 *
	 * 이미 대화하던 사이면 서버가 그 방을 그대로 돌려주므로 방이 새로 생기지 않는다.
	 */
	const handleStartDm = (partnerSeq: number) => {
		if (isCreatingRoom) return;
		setSearchError(null);
		createRoom(partnerSeq, {
			onSuccess: (room) => {
				setSearch("");
				handleOpenRoom(room.dmRoomSeq);
			},
			onError: (err) => {
				setSearchError(
					err instanceof ApiError ? err.message : "대화를 시작하지 못했습니다.",
				);
			},
		});
	};

	const handlePickImage = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
			setSendError("JPG, PNG, WEBP 이미지만 보낼 수 있습니다.");
			return;
		}
		if (file.size > MAX_IMAGE_SIZE) {
			setSendError("이미지는 최대 10MB까지 보낼 수 있습니다.");
			return;
		}
		setSendError(null);
		clearImage();
		setImage(file);
		setImagePreview(URL.createObjectURL(file));
	};

	const handleSend = async () => {
		const textContent = input.trim();
		// 서버는 텍스트·이미지 중 최소 하나를 요구한다.
		if ((!textContent && !image) || !selectedRoom || isSending) return;
		setSendError(null);
		try {
			await sendMessage({
				roomSeq: selectedRoom.dmRoomSeq,
				textContent: textContent || undefined,
				image,
			});
			setInput("");
			clearImage();
		} catch (err) {
			setSendError(
				err instanceof ApiError
					? err.message
					: err instanceof Error
						? err.message
						: "메시지를 보내지 못했습니다.",
			);
		}
	};

	if (!accessToken) {
		return (
			<div className="flex h-[calc(100dvh-var(--nav-h))] items-center justify-center border-t border-gray-200 bg-surface lg:h-[calc(100vh-var(--nav-h))] lg:border-l">
				<p className="text-[14px] font-light text-black/50">
					로그인 후 메시지를 확인할 수 있습니다.
				</p>
			</div>
		);
	}

	return (
		<div className="flex h-[calc(100dvh-var(--nav-h))] min-h-0 border-t border-gray-200 bg-white lg:h-[calc(100vh-var(--nav-h))] lg:border-l">
			{/* 좌: 채팅방 목록 */}
			<aside className={`${selectedRoom ? "hidden lg:flex" : "flex"} w-full flex-col border-r border-black/10 lg:max-w-[340px]`}>
				<div className="flex h-[58px] shrink-0 items-center justify-between border-b border-black/10 px-5 lg:h-auto lg:border-b-0 lg:pb-3 lg:pt-5">
					<h1 className="truncate text-[20px] font-extrabold text-black">
						{myNickname || "메시지"}
					</h1>
					<span className="shrink-0 text-[12px] font-light text-black/40">
						메시지
					</span>
				</div>

				{/* 팔로우한 사람을 찾아 바로 대화를 시작한다 */}
				<div className="shrink-0 px-5 pb-3 pt-3 lg:pt-0">
					<div className="flex h-10 items-center gap-2 rounded-full bg-black/[0.04] px-3.5">
						<SearchIcon size={15} className="shrink-0 text-black/35" />
						<input
							value={search}
							onChange={(event) => {
								setSearch(event.target.value);
								setSearchError(null);
							}}
							placeholder="팔로우한 사람 검색"
							maxLength={20}
							aria-label="대화 상대 검색"
							className="min-w-0 flex-1 bg-transparent text-[13px] font-light text-black outline-none placeholder:text-black/35"
						/>
						{search && (
							<button
								type="button"
								onClick={() => {
									setSearch("");
									setSearchError(null);
								}}
								aria-label="검색어 지우기"
								className="flex size-5 shrink-0 items-center justify-center rounded-full bg-black/15 text-[11px] font-bold leading-none text-white transition hover:bg-black/30">
								×
							</button>
						)}
					</div>
					{searchError && (
						<p role="alert" className="mt-2 text-[12px] text-brand">
							{searchError}
						</p>
					)}
				</div>

				{keyword ? (
					isFollowingPending ? (
						<StarttooLoader variant="block" size={150} label={null} />
					) : searchResults.length === 0 ? (
						<p className="px-5 py-10 text-center text-[13px] font-light leading-5 text-black/40">
							검색 결과가 없습니다.
							<br />
							팔로우한 사람에게만 먼저 말을 걸 수 있어요.
						</p>
					) : (
						<ul className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
							{searchResults.map((user) => (
								<li
									key={user.userId}
									className="border-b border-black/[0.06] lg:border-b-0">
									<button
										type="button"
										disabled={isCreatingRoom}
										onClick={() => handleStartDm(user.userId)}
										className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-black/[0.03] disabled:opacity-50 lg:py-3">
										<img
											src={resolveAvatar(user.profileImageUrl, user.nickname)}
											alt=""
											className="size-12 shrink-0 rounded-full bg-white object-cover lg:size-11"
										/>
										<span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-black lg:text-[14px]">
											{user.nickname}
										</span>
										<span className="shrink-0 text-[12px] font-semibold text-brand">
											메시지
										</span>
									</button>
								</li>
							))}
						</ul>
					)
				) : isRoomsPending ? (
					<StarttooLoader variant="block" size={150} label={null} />
				) : isRoomsError ? (
					<p className="px-5 py-10 text-center text-[13px] text-black/60">
						{roomsError instanceof ApiError
							? roomsError.message
							: "채팅방을 불러오지 못했습니다."}
					</p>
				) : rooms.length === 0 ? (
					<p className="px-5 py-10 text-center text-[13px] font-light text-black/40">
						아직 대화가 없습니다.
					</p>
				) : (
					<ul className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
						{rooms.map((room) => {
							const isSelected = room.dmRoomSeq === activeRoomSeq;
							const unread = room.unreadCount;
							return (
								<li key={room.dmRoomSeq} className="border-b border-black/[0.06] lg:border-b-0">
									<button
										type="button"
										onClick={() => handleOpenRoom(room.dmRoomSeq)}
									className={`flex w-full items-center gap-3 px-5 py-4 text-left transition lg:py-3 ${
											isSelected ? "bg-brand/5" : "hover:bg-black/[0.03]"
										}`}>
										<img
											src={resolveAvatar(
												room.partner.profileImageUrl,
												room.partner.nickname,
											)}
											alt=""
										className="size-12 shrink-0 rounded-full bg-white object-cover lg:size-11"
										/>
										<span className="min-w-0 flex-1">
											<span className="flex items-center gap-1.5">
												<span className="min-w-0 truncate text-[15px] font-semibold text-black lg:text-[14px]">
													{room.partner.nickname}
												</span>
												{room.partner.verified && <ArtistBadge size={15} />}
											</span>
											<span
												className={`mt-0.5 block truncate text-[12px] ${
													unread > 0
														? "font-semibold text-black"
														: "font-light text-black/45"
												}`}>
												{dmPreviewText(room.lastMessagePreview) ??
													"대화를 시작해보세요"}
											</span>
										</span>
										<span className="flex shrink-0 flex-col items-end gap-1">
											<span className="text-[11px] font-light text-black/35">
												{formatRoomTime(room.lastMessageDttm)}
											</span>
											{unread > 0 && (
												<span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
													{unread}
												</span>
											)}
										</span>
									</button>
								</li>
							);
						})}
						{hasMoreRooms && (
							<li className="px-5 py-3">
								<button
									type="button"
									onClick={() => void fetchMoreRooms()}
									disabled={isFetchingMoreRooms}
									className="w-full rounded-full border border-black/10 py-2 text-[12px] font-semibold text-black/55 transition hover:bg-black/5 disabled:opacity-50">
									{isFetchingMoreRooms ? <LoadingLabel>불러오는 중…</LoadingLabel> : "더 보기"}
								</button>
							</li>
						)}
					</ul>
				)}
			</aside>

			{/* 우: 대화창 */}
			{selectedRoom ? (
				<section className="flex min-w-0 flex-1 flex-col bg-white">
					<div className="flex h-[58px] shrink-0 items-center gap-2 border-b border-black/10 px-3 lg:h-auto lg:gap-3 lg:px-6 lg:py-3">
						<button type="button" aria-label="대화 목록으로 돌아가기" onClick={closeRoom} className="flex size-9 shrink-0 items-center justify-center text-black/65 lg:hidden"><BackIcon /></button>
						<Link
							to={profilePath(selectedRoom.partner.userSeq)}
							aria-label={`${selectedRoom.partner.nickname} 프로필`}>
							<img
								src={resolveAvatar(
									selectedRoom.partner.profileImageUrl,
									selectedRoom.partner.nickname,
								)}
								alt=""
								className="size-9 shrink-0 rounded-full bg-white object-cover transition hover:opacity-90"
							/>
						</Link>
						<div className="min-w-0 flex-1">
							<p className="flex items-center gap-1.5 text-[14px] font-semibold text-black">
								<Link
									to={profilePath(selectedRoom.partner.userSeq)}
									className="min-w-0 truncate hover:underline">
									{selectedRoom.partner.nickname}
								</Link>
								{selectedRoom.partner.verified && <ArtistBadge size={15} />}
							</p>
						</div>
						<DmRoomMenu room={selectedRoom} onLeft={closeRoom}>
							<MoreIcon size={20} />
						</DmRoomMenu>
					</div>

					<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6">
						{hasOlderMessages && (
							<div className="mb-3 flex justify-center">
								<button
									type="button"
									onClick={() => void fetchOlderMessages()}
									disabled={isFetchingOlder}
									className="rounded-full border border-black/10 px-4 py-1.5 text-[12px] font-semibold text-black/55 transition hover:bg-black/5 disabled:opacity-50">
									{isFetchingOlder ? <LoadingLabel>불러오는 중…</LoadingLabel> : "이전 메시지 보기"}
								</button>
							</div>
						)}

						{isMessagesPending ? (
							<StarttooLoader variant="block" size={170} label={null} />
						) : isMessagesError ? (
							<p className="py-10 text-center text-[13px] text-black/60">
								{messagesError instanceof ApiError
									? messagesError.message
									: "메시지를 불러오지 못했습니다."}
							</p>
						) : messages.length === 0 ? (
							<p className="py-10 text-center text-[13px] font-light text-black/40">
								첫 메시지를 보내보세요.
							</p>
						) : (
							messages.map((message, index) => (
								<MessageGroup
									key={message.dmMessageSeq}
									message={message}
									previous={messages[index - 1]}
									mine={message.senderSeq === myUserSeq}
								/>
							))
						)}
					</div>

					{sendError && (
						<p className="px-5 pb-1 text-[12px] text-red-600">{sendError}</p>
					)}

					{imagePreview && (
						<div className="flex items-center gap-3 px-5 pb-2">
							<div className="relative">
								<img
									src={imagePreview}
									alt="보낼 이미지"
									className="size-16 rounded-[10px] border border-black/10 object-cover"
								/>
								<button
									type="button"
									onClick={clearImage}
									aria-label="이미지 첨부 취소"
									className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-black/70 text-[11px] font-bold leading-none text-white transition hover:bg-black">
									×
								</button>
							</div>
							<span className="text-[12px] font-light text-black/45">
								{image?.name}
							</span>
						</div>
					)}

					<form
						className="flex shrink-0 items-center gap-2 border-t border-black/10 bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 lg:px-5 lg:py-3"
						onSubmit={(e) => {
							e.preventDefault();
							void handleSend();
						}}>
						<button
							type="button"
							onClick={() => imageInputRef.current?.click()}
							disabled={isSending}
							aria-label="이미지 첨부"
							className="flex size-10 shrink-0 items-center justify-center rounded-full border border-black/15 text-black/55 transition hover:bg-black/5 disabled:opacity-40">
							<ImageAttachIcon />
						</button>
						<input
							ref={imageInputRef}
							type="file"
							accept="image/jpeg,image/png,image/webp"
							className="hidden"
							onChange={handlePickImage}
						/>
						<input
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder="메시지 입력..."
							maxLength={4000}
							className="h-11 min-w-0 flex-1 rounded-full border border-black/15 bg-white px-4 text-[14px] font-light text-black outline-none placeholder:text-black/35 focus:border-brand/50 lg:h-10 lg:text-[13px]"
						/>
						<button
							type="submit"
							disabled={(!input.trim() && !image) || isSending}
							aria-label="전송"
							className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:brightness-95 disabled:bg-[#D9D9D9] disabled:text-black/35 lg:h-10 lg:w-auto lg:gap-1.5 lg:px-4">
							<ShareIcon size={17} />
							<span className="hidden text-[13px] font-semibold lg:inline">{isSending ? "전송 중…" : "전송"}</span>
						</button>
					</form>
				</section>
			) : (
				<section className="hidden flex-1 items-center justify-center bg-surface lg:flex">
					<div className="text-center">
						<p className="text-[16px] font-semibold text-black">
							대화를 선택해주세요
						</p>
					</div>
				</section>
			)}
		</div>
	);
}

/** 날짜가 바뀌는 지점에 구분선을 넣고 말풍선을 그린다 */
function MessageGroup({
	message,
	previous,
	mine,
}: {
	message: DmMessageResponse;
	previous: DmMessageResponse | undefined;
	mine: boolean;
}) {
	const dateLabel = formatDmDateLabel(message.regDttm);
	const showDate =
		previous == null || formatDmDateLabel(previous.regDttm) !== dateLabel;

	return (
		<>
			{showDate && (
				<p className="my-3 text-center text-[11px] font-light text-black/35">
					{dateLabel}
				</p>
			)}
			<MessageBubble message={message} mine={mine} />
		</>
	);
}
