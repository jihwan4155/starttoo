import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MoreIcon, ShareIcon } from "../components/community/icons";
import DmRoomMenu from "../components/dm/DmRoomMenu";
import MessageBubble from "../components/dm/MessageBubble";
import { formatDmDateLabel } from "../components/dm/dmTime";
import {
	useMarkDmRoomRead,
	useSendDmMessage,
} from "../hooks/mutations/useDmMutations";
import useDmMessages from "../hooks/queries/useDmMessages";
import useDmRooms from "../hooks/queries/useDmRooms";
import useMe from "../hooks/queries/useMe";
import useAuthStore from "../store/useAuthStore";
import useDmStore from "../store/useDmStore";
import useUserStore from "../store/useUserStore";
import { ApiError } from "../services/api";
import type { DmMessageResponse } from "../types/dm";
import { profilePath, resolveAvatar } from "../utils/profile";
import { formatDmTime } from "../components/dm/dmTime";

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

	const [input, setInput] = useState("");
	const [sendError, setSendError] = useState<string | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

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

	// DM 페이지를 벗어나면 선택 해제 (이후 수신 메시지는 알림으로 표시)
	useEffect(() => () => leaveDm(), [leaveDm]);

	// 방을 열면 상대 메시지·이 방의 NEW_DM 알림을 읽음 처리한다.
	useEffect(() => {
		if (activeRoomSeq == null) return;
		markRead(activeRoomSeq);
	}, [activeRoomSeq, markRead]);

	// 방 전환·새 메시지 시 맨 아래로. 과거 메시지를 더 불러온 경우는 제외한다.
	useEffect(() => {
		if (isFetchingOlder) return;
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [activeRoomSeq, messages.length, isFetchingOlder]);

	const handleOpenRoom = (roomSeq: number) => {
		openRoom(roomSeq);
		setInput("");
		setSendError(null);
	};

	const handleSend = async () => {
		const textContent = input.trim();
		if (!textContent || !selectedRoom || isSending) return;
		setSendError(null);
		try {
			await sendMessage({
				roomSeq: selectedRoom.dmRoomSeq,
				body: { textContent },
			});
			setInput("");
		} catch (err) {
			setSendError(
				err instanceof ApiError ? err.message : "메시지를 보내지 못했습니다.",
			);
		}
	};

	if (!accessToken) {
		return (
			<div className="flex h-[calc(100vh-60px)] items-center justify-center bg-surface">
				<p className="text-[14px] font-light text-black/50">
					로그인 후 메시지를 확인할 수 있습니다.
				</p>
			</div>
		);
	}

	return (
		<div className="flex h-[calc(100vh-60px)] bg-white">
			{/* 좌: 채팅방 목록 */}
			<aside className="flex w-full max-w-[340px] flex-col border-r border-black/10">
				<div className="flex items-center justify-between px-5 pb-3 pt-5">
					<h1 className="truncate text-[20px] font-extrabold text-black">
						{myNickname || "메시지"}
					</h1>
					<span className="shrink-0 text-[12px] font-light text-black/40">
						메시지
					</span>
				</div>

				{isRoomsPending ? (
					<p className="px-5 py-10 text-center text-[13px] text-black/40">
						불러오는 중…
					</p>
				) : isRoomsError ? (
					<p className="px-5 py-10 text-center text-[13px] text-black/60">
						{roomsError instanceof ApiError
							? roomsError.message
							: "채팅방을 불러오지 못했습니다."}
					</p>
				) : rooms.length === 0 ? (
					<p className="px-5 py-10 text-center text-[13px] font-light text-black/40">
						아직 대화가 없습니다.
						<br />
						아티스트 프로필에서 문의를 남겨보세요.
					</p>
				) : (
					<ul className="flex-1 overflow-y-auto">
						{rooms.map((room) => {
							const isSelected = room.dmRoomSeq === activeRoomSeq;
							const unread = room.unreadCount;
							return (
								<li key={room.dmRoomSeq}>
									<button
										type="button"
										onClick={() => handleOpenRoom(room.dmRoomSeq)}
										className={`flex w-full items-center gap-3 px-5 py-3 text-left transition ${
											isSelected ? "bg-brand/5" : "hover:bg-black/[0.03]"
										}`}>
										<img
											src={resolveAvatar(
												room.partner.profileImageUrl,
												room.partner.nickname,
											)}
											alt=""
											className="size-11 shrink-0 rounded-full bg-[#D9D9D9] object-cover"
										/>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-[14px] font-semibold text-black">
												{room.partner.nickname}
											</span>
											<span
												className={`mt-0.5 block truncate text-[12px] ${
													unread > 0
														? "font-semibold text-black"
														: "font-light text-black/45"
												}`}>
												{room.lastMessagePreview ?? "대화를 시작해보세요"}
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
									{isFetchingMoreRooms ? "불러오는 중…" : "더 보기"}
								</button>
							</li>
						)}
					</ul>
				)}
			</aside>

			{/* 우: 대화창 */}
			{selectedRoom ? (
				<section className="flex min-w-0 flex-1 flex-col">
					<div className="flex items-center gap-3 border-b border-black/10 px-6 py-3">
						<Link
							to={profilePath(selectedRoom.partner.userSeq)}
							aria-label={`${selectedRoom.partner.nickname} 프로필`}>
							<img
								src={resolveAvatar(
									selectedRoom.partner.profileImageUrl,
									selectedRoom.partner.nickname,
								)}
								alt=""
								className="size-9 shrink-0 rounded-full bg-[#D9D9D9] object-cover transition hover:opacity-90"
							/>
						</Link>
						<div className="min-w-0 flex-1">
							<p className="text-[14px] font-semibold text-black">
								<Link
									to={profilePath(selectedRoom.partner.userSeq)}
									className="truncate hover:underline">
									{selectedRoom.partner.nickname}
								</Link>
							</p>
						</div>
						<DmRoomMenu room={selectedRoom} onLeft={leaveDm}>
							<MoreIcon size={20} />
						</DmRoomMenu>
					</div>

					<div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
						{hasOlderMessages && (
							<div className="mb-3 flex justify-center">
								<button
									type="button"
									onClick={() => void fetchOlderMessages()}
									disabled={isFetchingOlder}
									className="rounded-full border border-black/10 px-4 py-1.5 text-[12px] font-semibold text-black/55 transition hover:bg-black/5 disabled:opacity-50">
									{isFetchingOlder ? "불러오는 중…" : "이전 메시지 보기"}
								</button>
							</div>
						)}

						{isMessagesPending ? (
							<p className="py-10 text-center text-[13px] text-black/40">
								불러오는 중…
							</p>
						) : isMessagesError ? (
							<p className="py-10 text-center text-[13px] text-black/60">
								메시지를 불러오지 못했습니다.
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

					<form
						className="flex items-center gap-2 border-t border-black/10 px-5 py-3"
						onSubmit={(e) => {
							e.preventDefault();
							void handleSend();
						}}>
						<input
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder="메시지 입력..."
							maxLength={4000}
							className="h-10 min-w-0 flex-1 rounded-full border border-black/15 bg-white px-4 text-[13px] font-light text-black outline-none placeholder:text-black/35 focus:border-brand/50"
						/>
						<button
							type="submit"
							disabled={!input.trim() || isSending}
							aria-label="전송"
							className="flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition hover:brightness-95 disabled:opacity-40">
							<ShareIcon size={16} />
							{isSending ? "전송 중…" : "전송"}
						</button>
					</form>
				</section>
			) : (
				<section className="flex flex-1 items-center justify-center bg-surface">
					<div className="text-center">
						<p className="text-[16px] font-semibold text-black">
							대화를 선택해주세요
						</p>
						<p className="mt-1 text-[13px] font-light text-black/45">
							아티스트에게 도안·시술 문의를 남겨보세요.
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
