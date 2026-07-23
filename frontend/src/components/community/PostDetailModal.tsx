import { useState } from "react";
import { createPortal } from "react-dom";
import {
	BookmarkIcon,
	CloseIcon,
	HeartIcon,
	MoreIcon,
} from "./icons";
import useCommunityStore from "../../store/useCommunityStore";
import { formatTimeAgo } from "../../utils/timeAgo";
import type { Post, PostComment } from "../../types/community";

function ExtractIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden>
			<path d="M12 3 13.5 8.5 19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />
			<path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
		</svg>
	);
}

function CommentRow({
	comment,
	isReply = false,
}: {
	comment: PostComment;
	isReply?: boolean;
}) {
	// 댓글 좋아요는 새로고침해도 유지되도록 전역 스토어 사용
	const isLiked = useCommunityStore((s) => !!s.commentLiked[comment.id]);
	const toggleCommentLike = useCommunityStore((s) => s.toggleCommentLike);
	return (
		<div className={isReply ? "mt-3 pl-10" : "mt-4"}>
			<div className="flex items-start gap-2.5">
				<span className="mt-0.5 size-7 shrink-0 rounded-full bg-[#D9D9D9]" />
				<div className="min-w-0 flex-1">
					<p className="text-[13px] leading-5 text-black">
						<span className="mr-2 font-semibold">
							{comment.author.nickname}
						</span>
						<span className="font-light">{comment.content}</span>
					</p>
					<div className="mt-1 flex items-center gap-3 text-[11px] font-light text-black/40">
						<span>{formatTimeAgo(comment.createdAt)}</span>
						<span>좋아요 {comment.likeCount + (isLiked ? 1 : 0)}</span>
						{!isReply && <button type="button">답글 달기</button>}
					</div>
				</div>
				<button
					type="button"
					aria-label="댓글 좋아요"
					onClick={() => toggleCommentLike(comment.id)}
					className={`mt-1 transition ${
						isLiked ? "text-brand" : "text-black/40 hover:text-brand"
					}`}>
					<HeartIcon size={14} filled={isLiked} />
				</button>
			</div>
			{comment.replies?.map((reply) => (
				<CommentRow key={reply.id} comment={reply} isReply />
			))}
		</div>
	);
}

type PostDetailModalProps = {
	post: Post | null;
	onClose: () => void;
};

export default function PostDetailModal({
	post,
	onClose,
}: PostDetailModalProps) {
	const [commentInput, setCommentInput] = useState("");
	// 좋아요·북마크·작성 댓글은 피드와 동기화되도록 전역 스토어 사용
	const isLiked = useCommunityStore((s) => !!post && !!s.liked[post.id]);
	const isBookmarked = useCommunityStore(
		(s) => !!post && !!s.bookmarked[post.id],
	);
	const myComments = useCommunityStore((s) =>
		post ? (s.extraComments[post.id] ?? null) : null,
	);
	const toggleLike = useCommunityStore((s) => s.toggleLike);
	const toggleBookmark = useCommunityStore((s) => s.toggleBookmark);
	const addComment = useCommunityStore((s) => s.addComment);

	if (!post) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
			onClick={onClose}
			role="presentation">
			<div
				className="flex max-h-[85vh] w-full max-w-[960px] overflow-hidden rounded-2xl bg-white"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="게시글 상세">
				{/* 좌: 이미지 */}
				<div className="group relative hidden min-h-[540px] flex-1 bg-black/90 sm:block">
					{post.imageUrl ? (
						<img
							src={post.imageUrl}
							alt={`${post.author.nickname}의 게시글`}
							className="h-full w-full object-contain"
						/>
					) : (
						<div className="h-full w-full bg-[#D9D9D9]" />
					)}
					{/* 호버 시 노출되는 도안 추출 버튼. TODO: 타투 추출·도안화 로직 연동 */}
					{post.imageUrl && (
						<button
							type="button"
							aria-label="도안 추출"
							className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 text-[13px] font-semibold text-black opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:bg-white/90 group-hover:opacity-100">
							<ExtractIcon />
							도안 추출
						</button>
					)}
				</div>

				{/* 우: 댓글 패널 */}
				<div className="flex w-full flex-col sm:w-[380px]">
					<div className="flex items-center gap-3 border-b border-black/10 px-5 py-4">
						<span className="size-8 shrink-0 rounded-full bg-[#D9D9D9]" />
						<div className="min-w-0 flex-1">
							<p className="truncate text-[14px] font-semibold text-black">
								{post.author.nickname}
							</p>
							<p className="text-[11px] font-light text-black/40">
								{formatTimeAgo(post.createdAt)}
							</p>
						</div>
						<button
							type="button"
							aria-label="게시글 메뉴"
							className="text-black/60">
							<MoreIcon size={20} />
						</button>
						<button
							type="button"
							aria-label="닫기"
							onClick={onClose}
							className="text-black/60 transition hover:text-black">
							<CloseIcon size={18} />
						</button>
					</div>

					<div className="flex-1 overflow-y-auto px-5 pb-4">
						<p className="mt-4 text-[13px] font-light leading-5 text-black">
							<span className="mr-2 font-semibold">
								{post.author.nickname}
							</span>
							{post.caption}
						</p>
						{post.comments.map((comment) => (
							<CommentRow key={comment.id} comment={comment} />
						))}
						{/* 이 세션에서 작성한 댓글 */}
						{myComments?.map((comment) => (
							<CommentRow key={comment.id} comment={comment} />
						))}
					</div>

					<div className="border-t border-black/10 px-5 py-3">
						<div className="flex items-center gap-4 text-black">
							<button
								type="button"
								aria-label="좋아요"
								onClick={() => toggleLike(post.id)}
								className={`flex items-center gap-1.5 ${
									isLiked ? "text-brand" : ""
								}`}>
								<HeartIcon filled={isLiked} />
								<span className="text-[13px] font-light">
									{post.likeCount + (isLiked ? 1 : 0)}
								</span>
							</button>
							<button
								type="button"
								aria-label="북마크"
								onClick={() => toggleBookmark(post.id)}
								className={`ml-auto ${isBookmarked ? "text-brand" : ""}`}>
								<BookmarkIcon filled={isBookmarked} />
							</button>
						</div>
						{/* TODO: 댓글 작성 API 연동 (현재는 스토어에만 추가) */}
						<form
							className="mt-3 flex items-center gap-2 rounded-full border border-black/15 py-1 pl-4 pr-1"
							onSubmit={(e) => {
								e.preventDefault();
								const content = commentInput.trim();
								if (!content) return;
								addComment(post.id, content);
								setCommentInput("");
							}}>
							<input
								value={commentInput}
								onChange={(e) => setCommentInput(e.target.value)}
								placeholder="댓글 달기..."
								className="min-w-0 flex-1 bg-transparent text-[13px] font-light text-black outline-none placeholder:text-black/35"
							/>
							<button
								type="submit"
								disabled={!commentInput.trim()}
								className="rounded-full bg-brand px-4 py-1.5 text-[13px] font-semibold text-white transition hover:brightness-95 disabled:opacity-40">
								게시
							</button>
						</form>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}
