import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
	BookmarkIcon,
	ChevronIcon,
	CloseIcon,
	HeartIcon,
	MoreIcon,
	ShareIcon,
} from "./icons";
import ArtistBadge from "../common/ArtistBadge";
import StarttooLoader from "../loader/StarttooLoader";
import useCreateComment from "../../hooks/mutations/useCreateComment";
import useDeleteComment from "../../hooks/mutations/useDeleteComment";
import useDeletePost from "../../hooks/mutations/useDeletePost";
import useDesignExtractMutation from "../../hooks/mutations/useDesignExtract";
import useHidePost from "../../hooks/mutations/useHidePost";
import useToggleCommentLike from "../../hooks/mutations/useToggleCommentLike";
import useTogglePostBookmark from "../../hooks/mutations/useTogglePostBookmark";
import useTogglePostLike from "../../hooks/mutations/useTogglePostLike";
import useCommentReplies from "../../hooks/queries/useCommentReplies";
import useComments from "../../hooks/queries/useComments";
import usePost from "../../hooks/queries/usePost";
import useAuthorDisplay from "../../hooks/useAuthorDisplay";
import useBackClose from "../../hooks/useBackClose";
import useImageSwipe from "../../hooks/useImageSwipe";
import usePostDwell from "../../hooks/usePostDwell";
import usePostEngagement from "../../hooks/usePostEngagement";
import useRequireAuth from "../../hooks/useRequireAuth";
import useCommunityStore from "../../store/useCommunityStore";
import DesignExtractResultModal from "./DesignExtractResultModal";
import ReportPostModal from "./ReportPostModal";
import EditPostModal from "./EditPostModal";
import DeletePostModal from "./DeletePostModal";
import DeleteCommentModal from "./DeleteCommentModal";
import SharePostModal from "./SharePostModal";
import { ApiError } from "../../services/api";
import { formatTimeAgo } from "../../utils/timeAgo";
import { getPostImageUrls } from "../../utils/mapPost";
import type { Post, PostComment } from "../../types/community";

/*
 * 사진 넘기기 화살표 버튼 — 모양을 바꾸려면 여기 두 값만 고치면 된다.
 * 어두운 사진 위에 얹히므로 피드 카드(흰 원)와 달리 검은 원이다.
 *
 *   size-7         원 지름 28px (size-6=24 · size-8=32 · size-9=36)
 *   bg-black/40    평소 불투명도 40% — 숫자를 낮출수록 더 투명해진다
 *   hover:bg-black/65  커서를 올렸을 때
 *   ARROW_ICON_SIZE  안쪽 꺾쇠 크기(px)
 */
const ARROW_BUTTON_CLASS =
	"absolute top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/65 disabled:opacity-30";
const ARROW_ICON_SIZE = 14;

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
	postId,
	comment,
	isReply = false,
	rootCommentId,
	onNavigate,
	onReply,
	autoOpenReplies = false,
}: {
	postId: number;
	comment: PostComment;
	isReply?: boolean;
	/** 답글일 때 최상위 댓글 ID (좋아요 캐시 갱신용) */
	rootCommentId?: number;
	/** 프로필로 이동하기 전 모달을 닫기 위한 콜백 */
	onNavigate?: () => void;
	/** 답글 작성은 맨 아래 입력창에서 한다 */
	onReply?: (commentId: number, nickname: string) => void;
	/** 이 댓글에 답글을 다는 중이면 답글 목록을 펼친다 */
	autoOpenReplies?: boolean;
}) {
	const [repliesOpen, setRepliesOpen] = useState(false);
	const [isCommentMenuOpen, setCommentMenuOpen] = useState(false);
	const [isDeleteCommentOpen, setDeleteCommentOpen] = useState(false);
	const commentMenuRef = useRef<HTMLDivElement>(null);
	const { requireAuth } = useRequireAuth();
	const { toggle: toggleCommentLike } = useToggleCommentLike();
	const { mutate: deleteCommentMutate, isPending: isDeleteCommentPending } =
		useDeleteComment();
	const isLiked = !!comment.liked;
	const { nickname, avatarUrl, profileTo, isMine } = useAuthorDisplay(
		comment.author,
	);

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

	// 아래 입력창에서 이 댓글에 답글을 다는 중이면 답글 목록을 펼쳐 둔다
	useEffect(() => {
		if (autoOpenReplies) setRepliesOpen(true);
	}, [autoOpenReplies]);

	useEffect(() => {
		if (!isCommentMenuOpen) return;
		const handleClickOutside = (event: MouseEvent) => {
			if (
				commentMenuRef.current &&
				!commentMenuRef.current.contains(event.target as Node)
			) {
				setCommentMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isCommentMenuOpen]);

	const handleDeleteComment = () => {
		setCommentMenuOpen(false);
		setDeleteCommentOpen(true);
	};

	const confirmDeleteComment = () => {
		if (!requireAuth()) return;
		deleteCommentMutate(
			{
				postId,
				commentId: comment.id,
				rootCommentId: isReply ? rootCommentId : undefined,
			},
			{
				onSuccess: () => setDeleteCommentOpen(false),
				onError: (err) => {
					window.alert(
						err instanceof ApiError
							? err.message
							: "댓글 삭제에 실패했습니다.",
					);
				},
			},
		);
	};

	return (
		<div className={`group/comment ${isReply ? "mt-3 pl-10" : "mt-4"}`}>
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
							className="font-semibold hover:underline">
							{nickname}
						</Link>
						{/* 본문과 한 문단으로 흐르므로 인라인으로 끼운다 */}
						{comment.author.isArtist && (
							<ArtistBadge size={13} className="mx-1 inline-block align-[-2px]" />
						)}
						<span className="ml-2 font-light">{comment.content}</span>
					</p>
					<div className="mt-1 flex items-center gap-3 text-[11px] font-light text-black/40">
						<span>{formatTimeAgo(comment.createdAt)}</span>
						<span>좋아요 {comment.likeCount}</span>
						{!isReply && (
							<button
								type="button"
								onClick={() => {
									if (!requireAuth()) return;
									onReply?.(comment.id, nickname);
								}}
								className="transition hover:text-black/60">
								답글 달기
							</button>
						)}
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
						<div className="mt-2 flex items-center gap-1.5 text-[11px] text-black/40">
							<StarttooLoader variant="mark" label={null} /> 답글을 불러오는
							중…
						</div>
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
				<div className="flex shrink-0 flex-col items-center gap-1">
					<button
						type="button"
						aria-label="댓글 좋아요"
						onClick={() =>
							requireAuth(() =>
								toggleCommentLike(
									{
										postId,
										commentId: comment.id,
										rootCommentId: isReply ? rootCommentId : undefined,
									},
									isLiked,
								),
							)
						}
						className={`transition disabled:opacity-50 ${
							isLiked ? "text-brand" : "text-black/40 hover:text-brand"
						}`}>
						<HeartIcon size={14} filled={isLiked} />
					</button>
					{isMine && (
						<div className="relative" ref={commentMenuRef}>
							<button
								type="button"
								aria-label="댓글 메뉴"
								onClick={() => setCommentMenuOpen((open) => !open)}
								className="flex size-6 items-center justify-center rounded-full text-black/35 opacity-70 transition hover:bg-black/5 hover:text-black/60 group-hover/comment:opacity-100">
								<MoreIcon size={14} />
							</button>
							{isCommentMenuOpen && (
								<div className="absolute right-0 top-7 z-30 w-max min-w-[140px] overflow-hidden rounded-[10px] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
									<button
										type="button"
										onClick={handleDeleteComment}
										className="block w-full px-4 py-2.5 text-left text-[12px] text-brand transition hover:bg-black/5">
										삭제
										<span className="mt-0.5 block text-[10px] font-light text-black/40">
											댓글을 삭제합니다
										</span>
									</button>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
			{repliesOpen &&
				loadedReplies.map((reply) => (
					<CommentRow
						key={reply.id}
						postId={postId}
						comment={reply}
						isReply
						rootCommentId={comment.id}
						onNavigate={onNavigate}
					/>
				))}
			<DeleteCommentModal
				isOpen={isDeleteCommentOpen}
				content={comment.content}
				onClose={() => setDeleteCommentOpen(false)}
				onConfirm={confirmDeleteComment}
				isPending={isDeleteCommentPending}
			/>
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
	const [commentError, setCommentError] = useState<string | null>(null);
	// 답글 대상 — 정해져 있으면 맨 아래 입력창이 답글 입력창이 된다
	const [replyTarget, setReplyTarget] = useState<{
		commentId: number;
		nickname: string;
	} | null>(null);
	const commentInputRef = useRef<HTMLInputElement>(null);
	const [isMenuOpen, setMenuOpen] = useState(false);
	const [isReportOpen, setReportOpen] = useState(false);
	const [isEditOpen, setEditOpen] = useState(false);
	const [isDeleteOpen, setDeleteOpen] = useState(false);
	const [isShareOpen, setShareOpen] = useState(false);
	const [imageIndex, setImageIndex] = useState(0);
	const menuRef = useRef<HTMLDivElement>(null);
	const { requireAuth } = useRequireAuth();
	const setLiked = useCommunityStore((s) => s.setLiked);
	const setBookmarked = useCommunityStore((s) => s.setBookmarked);

	const { data: detailPost } = usePost(seedPost?.id);
	const post = detailPost ?? seedPost;
	const isOpen = !!post;

	// 상세를 열어 둔 시간을 취향 점수에 반영 (닫히면 post가 없어져 그때 전송된다)
	usePostDwell(post?.id);

	// 뒤로가기는 뒤 페이지로 나가는 대신 이 모달만 닫는다
	useBackClose(isOpen, onClose);

	const emptyPost: Post = {
		id: 0,
		author: { nickname: "", isArtist: false },
		createdAt: "",
		imageUrl: null,
		caption: "",
		likeCount: 0,
		commentCount: 0,
		comments: [],
	};
	const { isLiked, isBookmarked } = usePostEngagement(post ?? emptyPost);
	// 훅 규칙상 early return 이전에 호출 (post 없을 때는 빈 작성자로 안전 처리)
	const {
		nickname: authorName,
		avatarUrl: authorAvatar,
		profileTo: authorProfileTo,
		isMine,
	} = useAuthorDisplay(post?.author ?? { nickname: "", isArtist: false });

	// 좋아요·북마크는 요청 중에도 계속 누를 수 있다 (화면은 즉시, 요청은 디바운스)
	const { toggle: toggleLike } = useTogglePostLike();
	const { toggle: toggleBookmark } = useTogglePostBookmark();
	const { mutate: createCommentMutate, isPending: isCommentPending } =
		useCreateComment();
	const { mutate: deletePostMutate, isPending: isDeletePending } = useDeletePost();
	const { mutate: hidePostMutate } = useHidePost();

	// 상세 GET /posts/{id}는 liked/bookmarked를 반환 → 로컬 스토어와 동기화
	useEffect(() => {
		if (!detailPost) return;
		setLiked(detailPost.id, !!detailPost.liked);
		setBookmarked(detailPost.id, !!detailPost.bookmarked);
	}, [detailPost, setLiked, setBookmarked]);

	// 모달이 열려 있는 동안 뒤 화면이 스크롤되지 않게 막는다.
	useEffect(() => {
		if (!isOpen) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [isOpen]);

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
	const handleEdit = () => {
		if (!post) return;
		setMenuOpen(false);
		if (!requireAuth()) return;
		setEditOpen(true);
	};

	const handleDelete = () => {
		if (!post) return;
		setMenuOpen(false);
		if (!requireAuth()) return;
		setDeleteOpen(true);
	};

	const confirmDelete = () => {
		if (!post) return;
		deletePostMutate(post.id, {
			onSuccess: () => {
				setDeleteOpen(false);
				onClose();
			},
			onError: (err) => {
				window.alert(
					err instanceof ApiError ? err.message : "삭제에 실패했습니다.",
				);
			},
		});
	};

	const handleBlock = () => {
		if (!post) return;
		setMenuOpen(false);
		if (!requireAuth()) return;
		onClose();
		hidePostMutate(
			{ postId: post.id, hidden: false },
			{
				onError: (err) => {
					window.alert(
						err instanceof ApiError ? err.message : "숨김 처리에 실패했습니다.",
					);
				},
			},
		);
	};
	// 분류 과정에서 저장한 도안 조회: 성공 시 결과 모달 표시
	const {
		mutate: loadStoredDesign,
		data: storedDesignResult,
		isPending: isDesignLoading,
		error: designLoadError,
		reset: resetStoredDesign,
	} = useDesignExtractMutation();

	// GET /posts/{postId}/comments (auth 없이 조회 가능)
	const {
		data: commentsPage,
		isPending: isCommentsPending,
		isError: isCommentsError,
		error: commentsError,
		refetch: refetchComments,
	} = useComments(post?.id, { size: 50 });

	const imageUrls = post ? getPostImageUrls(post) : [];
	const safeIndex =
		imageUrls.length === 0
			? 0
			: Math.min(imageIndex, imageUrls.length - 1);
	const postImageUrl = imageUrls[safeIndex] ?? null;
	const hasMultipleImages = imageUrls.length > 1;
	const currentTattooSeq = post?.imageTattooSeqs?.[safeIndex] ?? null;
	// tattooSeq가 있으면 분류 과정에서 타투로 판별되어 저장된 이미지다.
	const canExtractDesign = !!postImageUrl && currentTattooSeq != null;

	const { handlers: swipeHandlers, trackStyle } = useImageSwipe({
		count: imageUrls.length,
		index: safeIndex,
		onIndexChange: setImageIndex,
	});

	if (!post) return null;

	// "답글 달기" → 맨 아래 입력창을 답글 모드로 바꾸고 커서를 옮긴다
	const handleReplyStart = (commentId: number, nickname: string) => {
		setReplyTarget({ commentId, nickname });
		setCommentError(null);
		commentInputRef.current?.focus();
	};

	const apiComments = commentsPage?.items ?? [];
	const commentsErrorMessage =
		commentsError instanceof ApiError
			? commentsError.message
			: "댓글을 불러오지 못했습니다.";

	return createPortal(
		<div
			className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 lg:p-6"
			onClick={onClose}
			role="presentation">
			{/*
			  sm 이상에서는 높이를 먼저 정하고 이미지 칸이 그 높이에서 3:4 너비를 잡는다.
			  좁은 화면에서 이미지 칸이 눌리지 않도록, 남는 가로폭(댓글 패널 380px +
			  배경 여백 32px 제외)으로 만들 수 있는 높이도 함께 상한으로 둔다.
			*/}
			<div
				className="flex max-h-[80dvh] w-full max-w-[960px] overflow-hidden rounded-[12px] bg-white sm:h-[min(80dvh,760px,calc((100vw-412px)*4/3))] sm:w-auto sm:max-w-full lg:rounded-2xl"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="게시글 상세">
				{/* 좌: 이미지 캐러셀 — 게시물 비율(세로:가로 4:3)에 맞춘 칸 */}
				<div className="group relative hidden aspect-[3/4] h-full min-w-0 shrink bg-black/90 sm:block">
					{imageUrls.length > 0 ? (
						<div className="absolute inset-0 overflow-hidden" {...swipeHandlers}>
							<div className="flex h-full" style={trackStyle}>
								{imageUrls.map((url, index) => (
									<img
										key={`${url}-${index}`}
										src={url}
										alt={`${post.author.nickname}의 게시글 ${index + 1}`}
										draggable={false}
										className="h-full w-full shrink-0 object-contain"
									/>
								))}
							</div>
						</div>
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
								className={`${ARROW_BUTTON_CLASS} left-3`}>
								<ChevronIcon direction="left" size={ARROW_ICON_SIZE} />
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
								className={`${ARROW_BUTTON_CLASS} right-3`}>
								<ChevronIcon direction="right" size={ARROW_ICON_SIZE} />
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

					{/* 호버 시 노출되는 도안 추출 버튼 — 타투로 판별된 사진에서만 */}
					{canExtractDesign && currentTattooSeq != null && (
						<button
							type="button"
							aria-label="도안 추출"
							disabled={isDesignLoading}
							onClick={() => loadStoredDesign(currentTattooSeq)}
							className={`absolute right-4 flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 text-[13px] font-semibold text-black opacity-0 backdrop-blur-sm transition-opacity duration-200 hover:bg-white/90 disabled:cursor-wait disabled:opacity-100 group-hover:opacity-100 ${
								hasMultipleImages ? "bottom-10" : "bottom-4"
							}`}>
							{isDesignLoading ? (
								<>
									<span
										aria-hidden="true"
										className="size-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black"
									/>
									도안 추출 중...
								</>
							) : (
								<>
									<ExtractIcon />
									도안 추출
								</>
							)}
						</button>
					)}
					{designLoadError && (
						<p
							className={`absolute right-4 rounded-lg bg-black/60 px-3 py-1.5 text-[12px] font-light text-white ${
								hasMultipleImages ? "bottom-24" : "bottom-16"
							}`}>
							{designLoadError.message}
						</p>
					)}
				</div>

				{/* 우: 댓글 패널 */}
				<div className="flex w-full shrink-0 flex-col sm:w-[380px]">
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
							<div className="flex items-center gap-1.5">
								<Link
									to={authorProfileTo}
									onClick={onClose}
									className="min-w-0 truncate text-[14px] font-semibold text-black hover:underline">
									{authorName}
								</Link>
								{post.author.isArtist && <ArtistBadge size={15} />}
							</div>
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
										<>
											<button
												type="button"
												onClick={handleEdit}
												className="block w-full whitespace-nowrap px-4 py-2.5 text-left text-[13px] text-black transition hover:bg-black/5">
												수정
												<span className="mt-0.5 block text-[11px] font-light text-black/40">
													게시글 내용을 수정합니다
												</span>
											</button>
											<button
												type="button"
												onClick={handleDelete}
												className="block w-full whitespace-nowrap border-t border-black/5 px-4 py-2.5 text-left text-[13px] text-brand transition hover:bg-black/5">
												삭제
												<span className="mt-0.5 block text-[11px] font-light text-black/40">
													이 게시글을 삭제합니다
												</span>
											</button>
										</>
									) : (
										<>
											<button
												type="button"
												onClick={() => {
													setMenuOpen(false);
													if (!requireAuth()) return;
													setReportOpen(true);
												}}
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
												숨기기
												<span className="mt-0.5 block text-[11px] font-light text-black/40">
													이 게시글을 숨깁니다
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
								className="font-semibold hover:underline">
								{authorName}
							</Link>
							{post.author.isArtist && (
								<ArtistBadge size={13} className="mx-1 inline-block align-[-2px]" />
							)}
							<span className="ml-2">{post.caption}</span>
						</p>

						{isCommentsPending && (
							<div className="mt-8 flex items-center justify-center gap-2 text-[13px] text-black/40">
								<StarttooLoader variant="mark" label={null} /> 댓글을
								불러오는 중…
							</div>
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
							apiComments.length === 0 && (
								<p className="mt-8 text-center text-[13px] text-black/40">
									아직 댓글이 없습니다.
								</p>
							)}

						{!isCommentsPending &&
							apiComments.map((comment) => (
								<CommentRow
									key={comment.id}
									postId={post.id}
									comment={comment}
									onNavigate={onClose}
									onReply={handleReplyStart}
									autoOpenReplies={replyTarget?.commentId === comment.id}
								/>
							))}
					</div>

					<div className="border-t border-black/10 px-5 py-3">
						<div className="flex items-center gap-4 text-black">
							<button
								type="button"
								aria-label="좋아요"
								onClick={() => requireAuth(() => toggleLike(post.id, isLiked))}
								className={`flex items-center gap-1.5 disabled:opacity-50 ${
									isLiked ? "text-brand" : ""
								}`}>
								<HeartIcon filled={isLiked} />
								<span className="text-[13px] font-light">
									{post.likeCount}
								</span>
							</button>
							<button
								type="button"
								aria-label="공유"
								onClick={() => requireAuth(() => setShareOpen(true))}
								className="transition hover:text-black/60 disabled:opacity-50">
								<ShareIcon />
							</button>
							<button
								type="button"
								aria-label="북마크"
								onClick={() =>
									requireAuth(() => toggleBookmark(post.id, isBookmarked))
								}
								className={`ml-auto disabled:opacity-50 ${isBookmarked ? "text-brand" : ""}`}>
								<BookmarkIcon filled={isBookmarked} />
							</button>
						</div>
						{replyTarget && (
							<div className="mt-3 flex items-center gap-2 rounded-lg bg-black/5 px-3 py-1.5 text-[12px] font-light text-black/60">
								<span className="min-w-0 flex-1 truncate">
									<span className="font-semibold text-black/70">
										{replyTarget.nickname}
									</span>
									님에게 답글 남기는 중
								</span>
								<button
									type="button"
									aria-label="답글 취소"
									onClick={() => setReplyTarget(null)}
									className="shrink-0 text-black/40 transition hover:text-black/70">
									<CloseIcon size={14} />
								</button>
							</div>
						)}
						<form
							className="mt-3 flex items-center gap-2 rounded-full border border-black/15 py-1 pl-4 pr-1"
							onSubmit={(e) => {
								e.preventDefault();
								const content = commentInput.trim();
								if (!content || isCommentPending) return;
								if (!requireAuth()) return;
								setCommentError(null);
								createCommentMutate(
									{
										postId: post.id,
										content,
										parentCommentId: replyTarget?.commentId,
									},
									{
										onSuccess: () => {
											setCommentInput("");
											setReplyTarget(null);
										},
										onError: (err) => {
											setCommentError(
												err instanceof ApiError
													? err.message
													: replyTarget
														? "답글 작성에 실패했습니다."
														: "댓글 작성에 실패했습니다.",
											);
										},
									},
								);
							}}>
							<input
								ref={commentInputRef}
								value={commentInput}
								onChange={(e) => setCommentInput(e.target.value)}
								placeholder={
									replyTarget
										? `${replyTarget.nickname}님에게 답글 달기...`
										: "댓글 달기..."
								}
								maxLength={1000}
								className="min-w-0 flex-1 bg-transparent text-[13px] font-light text-black outline-none placeholder:text-black/35"
							/>
							<button
								type="submit"
								disabled={!commentInput.trim() || isCommentPending}
								className="rounded-full bg-brand px-4 py-1.5 text-[13px] font-semibold text-white transition hover:brightness-95 disabled:opacity-40">
								{isCommentPending ? "..." : "게시"}
							</button>
						</form>
						{commentError && (
							<p className="mt-2 text-[12px] text-brand">{commentError}</p>
						)}
					</div>
				</div>
			</div>

			<DesignExtractResultModal
				result={storedDesignResult ?? null}
				onClose={resetStoredDesign}
			/>
			<ReportPostModal
				postId={post.id}
				isOpen={isReportOpen}
				onClose={() => setReportOpen(false)}
			/>
			<EditPostModal
				post={post}
				isOpen={isEditOpen}
				onClose={() => setEditOpen(false)}
			/>
			<DeletePostModal
				isOpen={isDeleteOpen}
				caption={post.caption}
				imageUrl={postImageUrl}
				onClose={() => setDeleteOpen(false)}
				onConfirm={confirmDelete}
				isPending={isDeletePending}
			/>
			<SharePostModal
				post={isShareOpen ? post : null}
				onClose={() => setShareOpen(false)}
			/>
		</div>,
		document.body,
	);
}
