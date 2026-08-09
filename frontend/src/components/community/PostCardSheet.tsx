import { useEffect } from "react";
import { createPortal } from "react-dom";
import mobileLogo from "../../assets/images/mobile-logo.png";
import PostCard from "./PostCard";
import { ChevronIcon } from "./icons";
import useBackClose from "../../hooks/useBackClose";
import type { Post } from "../../types/community";

type PostCardSheetProps = {
	post: Post | null;
	/** 댓글 아이콘을 눌렀을 때 — 댓글 모달로 넘어간다 (사진 클릭은 아님) */
	onOpenComments: (post: Post) => void;
	onClose: () => void;
	/** 검색 결과가 가리킨 사진부터 카드를 연다 (PostDetailModal과 같은 규칙) */
	initialImageIndex?: number;
};

/**
 * 모바일 전용 피드 카드 화면.
 *
 * 썸네일 그리드에서 곧바로 댓글 창을 띄우면 좁은 화면에서는 사진을 볼 수 없다.
 * 그래서 커뮤니티 피드와 같은 카드 화면을 한 번 거친다.
 * 댓글 아이콘만 댓글 모달을 열고, 사진 클릭으로는 열지 않는다.
 *
 * z-[75]: 피드 상세(80) 바로 아래 — 댓글을 닫으면 이 화면으로 돌아온다.
 * (모바일 하단 내비게이션 55보다 위여서 카드가 전체 화면을 덮는다)
 */
export default function PostCardSheet({
	post,
	onOpenComments,
	onClose,
	initialImageIndex = 0,
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
			aria-label="게시물">
			{/* 상단바는 모바일 TopNav와 같은 높이·로고 크기 */}
			<div className="h-[44px] shrink-0 border-b border-black/10 bg-white">
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
						className="h-4 w-[96px] justify-self-center object-contain"
					/>
				</div>
			</div>

			{/* 커뮤니티 피드와 같은 폭·여백 — 카드가 같은 모양으로 보이게 */}
			<div className="flex-1 overflow-y-auto py-5">
				<div className="mx-auto w-full max-w-[440px] px-4">
					<PostCard
						post={post}
						onOpenComments={onOpenComments}
						initialImageIndex={initialImageIndex}
					/>
				</div>
			</div>
		</div>,
		document.body,
	);
}
