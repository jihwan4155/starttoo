import { useState } from "react";
import ImageViewerModal from "../common/ImageViewerModal";
import { formatDmTime } from "./dmTime";
import type { DmMessageResponse } from "../../types/dm";

type MessageBubbleProps = {
	message: DmMessageResponse;
	/** senderSeq === 내 userSeq */
	mine: boolean;
};

/**
 * DM 말풍선 — 텍스트·이미지·삭제 메시지
 *
 * 삭제된 메시지는 행이 남고 본문·이미지가 null로 내려온다.
 */
export default function MessageBubble({ message, mine }: MessageBubbleProps) {
	const [isViewerOpen, setViewerOpen] = useState(false);
	const time = formatDmTime(message.regDttm);

	if (message.deleted) {
		return (
			<div className={`my-1.5 flex ${mine ? "justify-end" : "justify-start"}`}>
				<div className="rounded-[16px] border border-black/10 px-4 py-2.5 text-[13px] font-light italic text-black/35">
					삭제된 메시지입니다
				</div>
			</div>
		);
	}

	return (
		<div className={`my-1.5 flex ${mine ? "justify-end" : "justify-start"}`}>
			<div
				className={`flex max-w-[75%] items-end gap-1.5 ${
					mine ? "flex-row" : "flex-row-reverse"
				}`}>
				<span className="shrink-0 text-[10px] font-light text-black/35">
					{time}
				</span>
				<div className="min-w-0">
					{message.imageUrl && (
						<button
							type="button"
							onClick={() => setViewerOpen(true)}
							className="block overflow-hidden rounded-[16px] bg-black/5">
							<img
								src={message.imageUrl}
								alt="주고받은 이미지"
								className="max-h-[280px] w-full object-cover transition hover:opacity-95"
							/>
						</button>
					)}
					{message.textContent && (
						<div
							className={`rounded-[16px] px-4 py-2.5 text-[13px] font-light leading-5 ${
								message.imageUrl ? "mt-1" : ""
							} ${
								mine
									? "rounded-br-[4px] bg-brand text-white"
									: "rounded-bl-[4px] bg-black/5 text-black"
							}`}>
							{message.textContent}
						</div>
					)}
				</div>
			</div>

			{message.imageUrl && (
				<ImageViewerModal
					src={message.imageUrl}
					alt="주고받은 이미지"
					isOpen={isViewerOpen}
					onClose={() => setViewerOpen(false)}
				/>
			)}
		</div>
	);
}
