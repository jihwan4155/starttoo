import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
	useLeaveDmRoom,
	useSetDmRoomNotification,
} from "../../hooks/mutations/useDmMutations";
import { ApiError } from "../../services/api";
import type { DmRoomResponse } from "../../types/dm";

type DmRoomMenuProps = {
	room: DmRoomResponse;
	/** 나가기 성공 후 — 선택 해제용 */
	onLeft: () => void;
	children: ReactNode;
};

/**
 * 대화 메뉴 — PATCH /dm/rooms/{seq}/notification, DELETE /dm/rooms/{seq}
 *
 * 나가기는 메시지를 지우지 않고 내 참여만 비활성화한다. 다만 나간 시점이 숨김
 * 기준으로 남아 이전 대화는 다시 볼 수 없으므로 한 번 확인을 받는다.
 */
export default function DmRoomMenu({
	room,
	onLeft,
	children,
}: DmRoomMenuProps) {
	const [isOpen, setOpen] = useState(false);
	const wrapRef = useRef<HTMLDivElement>(null);
	const { mutate: setNotification, isPending: isTogglingNotification } =
		useSetDmRoomNotification();
	const { mutate: leaveRoom, isPending: isLeaving } = useLeaveDmRoom();

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

	const handleToggleNotification = () => {
		setNotification(
			{ roomSeq: room.dmRoomSeq, enabled: !room.notificationEnabled },
			{
				onSuccess: () => setOpen(false),
				onError: (err) => {
					window.alert(
						err instanceof ApiError
							? err.message
							: "알림 설정을 변경하지 못했습니다.",
					);
				},
			},
		);
	};

	const handleLeave = () => {
		const confirmed = window.confirm(
			`${room.partner.nickname}님과의 대화에서 나가시겠습니까?\n나가기 전 대화 내용은 다시 볼 수 없습니다.`,
		);
		if (!confirmed) return;
		leaveRoom(room.dmRoomSeq, {
			onSuccess: () => {
				setOpen(false);
				onLeft();
			},
			onError: (err) => {
				window.alert(
					err instanceof ApiError
						? err.message
						: "채팅방을 나가지 못했습니다.",
				);
			},
		});
	};

	const isBusy = isTogglingNotification || isLeaving;

	return (
		<div ref={wrapRef} className="relative">
			<button
				type="button"
				aria-label="대화 메뉴"
				aria-expanded={isOpen}
				onClick={() => setOpen((prev) => !prev)}
				className="text-black/60 transition hover:text-black">
				{children}
			</button>

			{isOpen && (
				<div className="absolute right-0 top-full z-20 mt-2 w-[180px] overflow-hidden rounded-[12px] border border-black/10 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.10)]">
					<button
						type="button"
						onClick={handleToggleNotification}
						disabled={isBusy}
						className="block w-full px-4 py-3 text-left text-[13px] text-black transition hover:bg-black/[0.03] disabled:opacity-50">
						{room.notificationEnabled ? "알림 끄기" : "알림 켜기"}
					</button>
					<button
						type="button"
						onClick={handleLeave}
						disabled={isBusy}
						className="block w-full border-t border-black/[0.06] px-4 py-3 text-left text-[13px] text-red-600 transition hover:bg-red-50 disabled:opacity-50">
						{isLeaving ? "나가는 중…" : "채팅방 나가기"}
					</button>
				</div>
			)}
		</div>
	);
}
