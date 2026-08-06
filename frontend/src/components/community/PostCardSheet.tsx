import { useEffect } from "react";
import { createPortal } from "react-dom";
import mobileLogo from "../../assets/images/mobile-logo.png";
import PostCard from "./PostCard";
import { ChevronIcon } from "./icons";
import useBackClose from "../../hooks/useBackClose";
import type { Post } from "../../types/community";

type PostCardSheetProps = {
	post: Post | null;
	/** 카드의 사진·댓글 아이콘을 눌렀을 때 — 댓글(게시글 상세)로 넘어간다 */
	onOpenComments: (post: Post) => void;
	onClose: () => void;
};

/**
 * 모바일 전용 게시글 카드 화면.
 *
 * 썸네일 그리드에서 곧바로 댓글 창을 띄우면 좁은 화면에서는 사진을 볼 수 없다.
 * 그래서 커뮤니티 피드와 같은 카드 화면을 한 번 거치고, 여기서 사진이나 댓글
 * 아이콘을 눌렀을 때 댓글로 들어가게 한다.
 *
 * z-[75]: 게시글 상세(80) 바로 아래 — 댓글을 닫으면 이 화면으로 돌아온다.
 * (모바일 하단 내비게이션 55보다 위여서 카드가 전체 화면을 덮는다)
 */
export default function PostCardSheet({
	post,
	onOpenComments,
	onClose,
}: PostCardSheetProps) {
	const isOpen = !!post;

	// 뒤로가기는 프로필 페이지를 떠나는 대신 이 화면만 닫는다
	useBackClose(isOpen, onClose);

	// 열려 있는 동안 뒤 목록이 스크롤되지 않게 막는다 (상세 모달과 같은 방식).
	useEffect(() => {
		if (!isOpen) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [isOpen]);

	if (!post) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-[75] flex flex-col bg-surface"
			role="dialog"
			aria-modal="true"
			aria-label="게시글">
			{/* 상단바는 모바일 내비게이션과 같은 모양 — 가운데 로고, 왼쪽은 뒤로 가기 */}
			<div className="h-[50px] shrink-0 border-b border-black/10 bg-white">
				<div className="grid h-full grid-cols-[48px_1fr_48px] items-center px-4">
					<button
						type="button"
						aria-label="뒤로"
						onClick={onClose}
						className="flex size-10 items-center justify-start text-black/70 outline-none transition hover:text-black focus-visible:ring-2 focus-visible:ring-brand/40">
						<ChevronIcon direction="left" size={20} />
					</button>
					<img
						src={mobileLogo}
						alt="starttoo"
						className="h-5 w-[120px] justify-self-center object-contain"
					/>
				</div>
			</div>

			{/* 커뮤니티 피드와 같은 폭·여백 — 카드가 같은 모양으로 보이게 */}
			<div className="flex-1 overflow-y-auto py-5">
				<div className="mx-auto w-full max-w-[440px] px-4">
					<PostCard post={post} onOpen={onOpenComments} />
				</div>
			</div>
		</div>,
		document.body,
	);
}
