import { useEffect, useRef, useState } from "react";
import ArtistBadge from "../components/common/ArtistBadge";
import { MoreIcon, ShareIcon } from "../components/community/icons";
import useDmStore from "../store/useDmStore";
import type { DmMessage } from "../types/dm";

function MessageBubble({ message }: { message: DmMessage }) {
	if (message.isNotice) {
		return (
			<div className="my-2 flex justify-start">
				<div className="max-w-[75%] rounded-[14px] border border-brand/30 bg-brand/10 px-4 py-3 text-[13px] font-light leading-5 text-black">
					{message.content}
				</div>
			</div>
		);
	}
	return (
		<div className={`my-1.5 flex ${message.mine ? "justify-end" : "justify-start"}`}>
			<div className="flex max-w-[75%] items-end gap-1.5">
				{message.mine && (
					<span className="shrink-0 text-[10px] font-light text-black/35">
						{message.time}
					</span>
				)}
				<div
					className={`rounded-[16px] px-4 py-2.5 text-[13px] font-light leading-5 ${
						message.mine
							? "rounded-br-[4px] bg-brand text-white"
							: "rounded-bl-[4px] bg-black/5 text-black"
					}`}>
					{message.content}
				</div>
				{!message.mine && (
					<span className="shrink-0 text-[10px] font-light text-black/35">
						{message.time}
					</span>
				)}
			</div>
		</div>
	);
}

/** DM — 채팅방 목록 + 대화창 (시연용 목업, TODO: /dm/rooms API 연동) */
export default function DmPage() {
	const rooms = useDmStore((s) => s.rooms);
	const activeRoomId = useDmStore((s) => s.activeRoomId);
	const openRoomStore = useDmStore((s) => s.openRoom);
	const leaveDm = useDmStore((s) => s.leaveDm);
	const sendMessage = useDmStore((s) => s.sendMessage);
	const [input, setInput] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);

	const selectedRoom = rooms.find((room) => room.id === activeRoomId) ?? null;

	// DM 페이지를 벗어나면 활성 방 해제 (이후 수신 메시지는 알림으로 표시)
	useEffect(() => () => leaveDm(), [leaveDm]);

	// 새 메시지가 오면 대화창을 맨 아래로 스크롤
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [selectedRoom?.messages]);

	const openRoom = (roomId: number) => {
		openRoomStore(roomId);
		setInput("");
	};

	const handleSend = () => {
		const content = input.trim();
		if (!content || !selectedRoom) return;
		sendMessage(selectedRoom.id, content);
		setInput("");
	};

	return (
		<div className="flex h-[calc(100vh-60px)] bg-white">
			{/* 좌: 채팅방 목록 */}
			<aside className="flex w-full max-w-[340px] flex-col border-r border-black/10">
				<div className="flex items-center justify-between px-5 pb-3 pt-5">
					<h1 className="text-[20px] font-extrabold text-black">스누피</h1>
					<span className="text-[12px] font-light text-black/40">메시지</span>
				</div>
				<ul className="flex-1 overflow-y-auto">
					{rooms.map((room) => {
						const isSelected = room.id === activeRoomId;
						const unread = room.unreadCount;
						return (
							<li key={room.id}>
								<button
									type="button"
									onClick={() => openRoom(room.id)}
									className={`flex w-full items-center gap-3 px-5 py-3 text-left transition ${
										isSelected ? "bg-brand/5" : "hover:bg-black/[0.03]"
									}`}>
									<span className="size-11 shrink-0 rounded-full bg-[#D9D9D9]" />
									<span className="min-w-0 flex-1">
										<span className="flex items-center gap-1.5">
											<span className="truncate text-[14px] font-semibold text-black">
												{room.nickname}
											</span>
											{room.isArtist && <ArtistBadge size={14} />}
										</span>
										<span
											className={`mt-0.5 block truncate text-[12px] ${
												unread > 0
													? "font-semibold text-black"
													: "font-light text-black/45"
											}`}>
											{room.lastMessage}
										</span>
									</span>
									<span className="flex shrink-0 flex-col items-end gap-1">
										<span className="text-[11px] font-light text-black/35">
											{room.lastTime}
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
				</ul>
			</aside>

			{/* 우: 대화창 */}
			{selectedRoom ? (
				<section className="flex min-w-0 flex-1 flex-col">
					<div className="flex items-center gap-3 border-b border-black/10 px-6 py-3">
						<span className="size-9 shrink-0 rounded-full bg-[#D9D9D9]" />
						<div className="min-w-0 flex-1">
							<p className="flex items-center gap-1.5 text-[14px] font-semibold text-black">
								<span className="truncate">{selectedRoom.nickname}</span>
								{selectedRoom.isArtist && <ArtistBadge size={15} />}
							</p>
						</div>
						<button
							type="button"
							aria-label="대화 메뉴"
							className="text-black/60">
							<MoreIcon size={20} />
						</button>
					</div>

					<div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
						<p className="my-3 text-center text-[11px] font-light text-black/35">
							{selectedRoom.dateLabel}
						</p>
						{selectedRoom.messages.map((message) => (
							<MessageBubble key={message.id} message={message} />
						))}
					</div>

					<form
						className="flex items-center gap-2 border-t border-black/10 px-5 py-3"
						onSubmit={(e) => {
							e.preventDefault();
							handleSend();
						}}>
						<input
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder="메시지 입력..."
							className="h-10 min-w-0 flex-1 rounded-full border border-black/15 bg-white px-4 text-[13px] font-light text-black outline-none placeholder:text-black/35 focus:border-brand/50"
						/>
						<button
							type="submit"
							disabled={!input.trim()}
							aria-label="전송"
							className="flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition hover:brightness-95 disabled:opacity-40">
							<ShareIcon size={16} />
							전송
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
