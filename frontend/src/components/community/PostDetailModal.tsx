import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
	BookmarkIcon,
	ChevronIcon,
	CloseIcon,
	HeartIcon,
	MoreIcon,
} from "./icons";
import useCommunityStore from "../../store/useCommunityStore";
import useDesignExtractMutation from "../../hooks/mutations/useDesignExtract";
import useCommentReplies from "../../hooks/queries/useCommentReplies";
import useComments from "../../hooks/queries/useComments";
import usePost from "../../hooks/queries/usePost";
import useAuthorDisplay from "../../hooks/useAuthorDisplay";
import DesignExtractResultModal from "./DesignExtractResultModal";
import { ApiError } from "../../services/api";
import { formatTimeAgo } from "../../utils/timeAgo";
import { getPostImageUrls } from "../../utils/mapPost";
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
	onNavigate,
}: {
	comment: PostComment;
	isReply?: boolean;
	/** 프로필로 이동하기 전 모달을 닫기 위한 콜백 */
	onNavigate?: () => void;
}) {
	const [repliesOpen, setRepliesOpen] = useState(false);
	const isLiked = useCommunityStore((s) => !!s.commentLiked[comment.id]);
	const toggleCommentLike = useCommunityStore((s) => s.toggleCommentLike);
	const { nickname, avatarUrl, profileTo } = useAuthorDisplay(comment.author);

	const replyCount = comment.replyCount ?? 0;
	const {
		data: repliesPage,
		isPending: isRepliesPending,
		isError: isRepliesError,
		refetch: refetchReplies,
	} = useCommentReplies(repliesOpen && !isReply ? comment.id : undefined, {
		size: 50,
	});

	const loadedReplies = repliesPage?.items ?? [];

	return (
		<div className={isReply ? "mt-3 pl-10" : "mt-4"}>
			<div className="flex items-start gap-2.5">
				<Link
					to={profileTo}
					onClick={onNavigate}
					aria-label={`${nickname} 프로필`}>
					<img
						src={avatarUrl}
						alt=""
						className="mt-0.5 size-7 shrink-0 rounded-full bg-[#D9D9D9] object-cover transition hover:opacity-90"
					/>
				</Link>
				<div className="min-w-0 flex-1">
					<p className="text-[13px] leading-5 text-black">
						<Link
							to={profileTo}
							onClick={onNavigate}
							className="mr-2 font-semibold hover:underline">
							{nickname}
						</Link>
						<span className="font-light">{comment.content}</span>
					</p>
					<div className="mt-1 flex items-center gap-3 text-[11px] font-light text-black/40">
						<span>{formatTimeAgo(comment.createdAt)}</span>
						<span>좋아요 {comment.likeCount + (isLiked ? 1 : 0)}</span>
						{!isReply && <button type="button">답글 달기</button>}
					</div>
					{!isReply && replyCount > 0 && (
						<button
							type="button"
							onClick={() => setRepliesOpen((open) => !open)}
							className="mt-2 text-[12px] font-semibold text-black/50 transition hover:text-black/70">
							{repliesOpen
								? "답글 숨기기"
								: `답글 ${replyCount}개 보기`}
						</button>
					)}
					{repliesOpen && isRepliesPending && (
						<p className="mt-2 text-[11px] text-black/40">
							답글을 불러오는 중…
						</p>
					)}
					{repliesOpen && isRepliesError && (
						<button
							type="button"
							onClick={() => void refetchReplies()}
							className="mt-2 text-[11px] font-semibold text-brand">
							답글 다시 시도
						</button>
					)}
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
			{repliesOpen &&
				loadedReplies.map((reply) => (
					<CommentRow
						key={reply.id}
						comment={reply}
						isReply
						onNavigate={onNavigate}
					/>
				))}
		</div>
	);
}

type PostDetailModalProps = {
	post: Post | null;
	onClose: () => void;
};

export default function PostDetailModal({
	post: seedPost,
	onClose,
}: PostDetailModalProps) {
	const [commentInput, setCommentInput] = useState("");
	const [isMenuOpen, setMenuOpen] = useState(false);
	const [imageIndex, setImageIndex] = useState(0);
	const menuRef = useRef<HTMLDivElement>(null);

	// GET /posts/{id} — 목록 데이터보다 단건이 우선 (이미지·카운트 최신화)
	const { data: detailPost } = usePost(seedPost?.id);
	const post = detailPost ?? seedPost;

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
	const deletePost = useCommunityStore((s) => s.deletePost);
	const hidePost = useCommunityStore((s) => s.hidePost);
	// 훅 규칙상 early return 이전에 호출 (post 없을 때는 빈 작성자로 안전 처리)
	const {
		nickname: authorName,
		avatarUrl: authorAvatar,
		profileTo: authorProfileTo,
		isMine,
	} = useAuthorDisplay(post?.author ?? { nickname: "", isArtist: false });

	// 메뉴 바깥을 클릭하면 닫기 (PostCard와 동일 패턴)
	useEffect(() => {
		if (!isMenuOpen) return;
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isMenuOpen]);

	// 삭제 시 스토어에서 제거되면 모달을 닫아 사라진 게시글이 남지 않게 한다.
	const handleDelete = () => {
		if (!post) return;
		setMenuOpen(false);
		if (window.confirm("이 게시글을 삭제할까요?")) {
			deletePost(post.id);
			onClose();
		}
	};

	const handleBlock = () => {
		if (!post) return;
		setMenuOpen(false);
		hidePost(post.id);
		onClose();
	};
	// 도안 추출: 성공 시 결과 모달 표시. TODO: 내 보관함 저장 연동
	const {
		mutate: extractDesign,
		data: extractResult,
		isPending: isExtracting,
		error: extractError,
		reset: resetExtract,
	} = useDesignExtractMutation();

	// GET /posts/{postId}/comments (auth 없이 조회 가능)
	const {
		data: commentsPage,
		isPending: isCommentsPending,
		isError: isCommentsError,
		error: commentsError,
		refetch: refetchComments,
	} = useComments(post?.id, { size: 50, sort: "LATEST" });

	if (!post) return null;

	const apiComments = commentsPage?.items ?? [];
	const commentsErrorMessage =
		commentsError instanceof ApiError
			? commentsError.message
			: "댓글을 불러오지 못했습니다.";

	const imageUrls = getPostImageUrls(post);
	const safeIndex =
		imageUrls.length === 0
			? 0
			: Math.min(imageIndex, imageUrls.length - 1);
	const postImageUrl = imageUrls[safeIndex] ?? null;
	const hasMultipleImages = imageUrls.length > 1;

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
				{/* 좌: 이미지 캐러셀 */}
				<div className="group relative hidden min-h-[540px] flex-1 bg-black/90 sm:block">
					{postImageUrl ? (
						<img
							src={postImageUrl}
							alt={`${post.author.nickname}의 게시글 ${safeIndex + 1}`}
							className="h-full w-full object-contain"
						/>
					) : (
						<div className="h-full w-full bg-[#D9D9D9]" />
					)}

					{hasMultipleImages && (
						<>
							<button
								type="button"
								aria-label="이전 사진"
								disabled={safeIndex === 0}
								onClick={() => setImageIndex((i) => Math.max(0, i - 1))}
								className="absolute left-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75 disabled:opacity-30">
								<ChevronIcon direction="left" size={16} />
							</button>
							<button
								type="button"
								aria-label="다음 사진"
								disabled={safeIndex === imageUrls.length - 1}
								onClick={() =>
									setImageIndex((i) =>
										Math.min(imageUrls.length - 1, i + 1),
									)
								}
								className="absolute right-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75 disabled:opacity-30">
								<ChevronIcon direction="right" size={16} />
							</button>
							<div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
								{imageUrls.map((_, index) => (
									<span
										key={index}
										className={`size-1.5 rounded-full transition ${
											index === safeIndex
												? "bg-white"
												: "bg-white/40"
										}`}
									/>
								))}
							</div>
							<span className="absolute right-4 top-4 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white">
								{safeIndex + 1} / {imageUrls.length}
							</span>
						</>
					)}

					{/* 호버 시 노출되는 도안 추출 버튼 */}
					{postImageUrl && (
						<button
							type="button"
							aria-label="도안 추출"
							disabled={isExtracting}
							onClick={() => extractDesign(postImageUrl)}
							className={`absolute right-4 flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 text-[13px] font-semibold text-black opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:bg-white/90 disabled:cursor-wait disabled:opacity-100 group-hover:opacity-100 ${
								hasMultipleImages ? "bottom-10" : "bottom-4"
							}`}>
							<ExtractIcon />
							{isExtracting ? "추출 중..." : "도안 추출"}
						</button>
					)}
					{extractError && (
						<p
							className={`absolute right-4 rounded-lg bg-black/60 px-3 py-1.5 text-[12px] font-light text-white ${
								hasMultipleImages ? "bottom-24" : "bottom-16"
							}`}>
							{extractError.message}
						</p>
					)}
				</div>

				{/* 우: 댓글 패널 */}
				<div className="flex w-full flex-col sm:w-[380px]">
					<div className="flex items-center gap-3 border-b border-black/10 px-5 py-4">
						<Link
							to={authorProfileTo}
							onClick={onClose}
							aria-label={`${authorName} 프로필`}>
							<img
								src={authorAvatar}
								alt=""
								className="size-8 shrink-0 rounded-full bg-[#D9D9D9] object-cover transition hover:opacity-90"
							/>
						</Link>
						<div className="min-w-0 flex-1">
							<Link
								to={authorProfileTo}
								onClick={onClose}
								className="block truncate text-[14px] font-semibold text-black hover:underline">
								{authorName}
							</Link>
							<p className="text-[11px] font-light text-black/40">
								{formatTimeAgo(post.createdAt)}
							</p>
						</div>
						<div className="relative" ref={menuRef}>
							<button
								type="button"
								aria-label="게시글 메뉴"
								onClick={() => setMenuOpen((prev) => !prev)}
								className="flex size-8 items-center justify-center rounded-full text-black/60 transition hover:bg-black/5">
								<MoreIcon size={20} />
							</button>
							{isMenuOpen && (
								<div className="absolute right-0 top-9 z-20 w-max min-w-[160px] overflow-hidden rounded-[10px] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
									{isMine ? (
										<button
											type="button"
											onClick={handleDelete}
											className="block w-full whitespace-nowrap px-4 py-2.5 text-left text-[13px] text-brand transition hover:bg-black/5">
											삭제
											<span className="mt-0.5 block text-[11px] font-light text-black/40">
												이 게시글을 삭제합니다
											</span>
										</button>
									) : (
										<>
											{/* TODO: 신고 API 연동 */}
											<button
												type="button"
												onClick={() => setMenuOpen(false)}
												className="block w-full whitespace-nowrap px-4 py-2.5 text-left text-[13px] text-black transition hover:bg-black/5">
												신고
												<span className="mt-0.5 block text-[11px] font-light text-black/40">
													건전한 커뮤니티
												</span>
											</button>
											<button
												type="button"
												onClick={handleBlock}
												className="block w-full whitespace-nowrap px-4 py-2.5 text-left text-[13px] text-brand transition hover:bg-black/5">
												차단
												<span className="mt-0.5 block text-[11px] font-light text-black/40">
													이 사용자 게시글 숨기기
												</span>
											</button>
										</>
									)}
								</div>
							)}
						</div>
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
							<Link
								to={authorProfileTo}
								onClick={onClose}
								className="mr-2 font-semibold hover:underline">
								{authorName}
							</Link>
							{post.caption}
						</p>

						{isCommentsPending && (
							<p className="mt-8 text-center text-[13px] text-black/40">
								댓글을 불러오는 중…
							</p>
						)}

						{isCommentsError && (
							<div className="mt-8 flex flex-col items-center gap-3">
								<p className="text-center text-[13px] text-black/60">
									{commentsErrorMessage}
								</p>
								<button
									type="button"
									onClick={() => void refetchComments()}
									className="rounded-full border border-black/20 px-4 py-1.5 text-[12px] font-semibold transition hover:bg-black/5">
									다시 시도
								</button>
							</div>
						)}

						{!isCommentsPending &&
							!isCommentsError &&
							apiComments.length === 0 &&
							!(myComments && myComments.length > 0) && (
								<p className="mt-8 text-center text-[13px] text-black/40">
									아직 댓글이 없습니다.
								</p>
							)}

						{!isCommentsPending &&
							apiComments.map((comment) => (
								<CommentRow
									key={comment.id}
									comment={comment}
									onNavigate={onClose}
								/>
							))}

						{/* 이 세션에서 작성한 댓글 (작성 API 연동 전 로컬) */}
						{myComments?.map((comment) => (
							<CommentRow
								key={comment.id}
								comment={comment}
								onNavigate={onClose}
							/>
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

			<DesignExtractResultModal
				result={extractResult ?? null}
				onClose={resetExtract}
			/>
		</div>,
		document.body,
	);
}
