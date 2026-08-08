import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
	BookmarkIcon,
	ChevronIcon,
	CommentIcon,
	HeartIcon,
	MoreIcon,
	ShareIcon,
} from "./icons";
import ArtistBadge from "../common/ArtistBadge";
import DesignExtractResultModal from "./DesignExtractResultModal";
import ReportPostModal from "./ReportPostModal";
import EditPostModal from "./EditPostModal";
import DeletePostModal from "./DeletePostModal";
import SharePostModal from "./SharePostModal";
import HiddenPostOverlay from "./HiddenPostOverlay";
import ArchiveFullModal from "../common/ArchiveFullModal";
import useDeletePost from "../../hooks/mutations/useDeletePost";
import useDesignExtractMutation from "../../hooks/mutations/useDesignExtract";
import useHidePost from "../../hooks/mutations/useHidePost";
import useTogglePostBookmark from "../../hooks/mutations/useTogglePostBookmark";
import useTogglePostLike from "../../hooks/mutations/useTogglePostLike";
import useArchiveCapacity from "../../hooks/queries/useArchiveCapacity";
import useAuthorDisplay from "../../hooks/useAuthorDisplay";
import { avatarImageClassName } from "../../utils/profile";
import useImageSwipe from "../../hooks/useImageSwipe";
import usePostEngagement from "../../hooks/usePostEngagement";
import useRequireAuth from "../../hooks/useRequireAuth";
import usePostHiddenOverlay from "../../hooks/usePostHidden";
import { ApiError } from "../../services/api";
import { getPostImageUrls } from "../../utils/mapPost";
import { formatTimeAgo } from "../../utils/timeAgo";
import type { Post } from "../../types/community";

/*
 * 사진 넘기기 화살표 버튼 — 모양을 바꾸려면 여기 두 값만 고치면 된다.
 * 좌/우 위치(left-2·right-2)만 쓰는 쪽에서 붙인다.
 *
 *   size-6         원 지름 24px (size-5=20 · size-7=28 · size-8=32)
 *   bg-white/55    평소 불투명도 55% — 숫자를 낮출수록 더 투명해진다
 *   hover:bg-white/80  커서를 올렸을 때
 *   size={13}      안쪽 꺾쇠 크기(px) — ARROW_ICON_SIZE
 */
const ARROW_BUTTON_CLASS =
	"absolute top-1/2 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/55 text-black shadow-[0_2px_6px_rgba(0,0,0,0.10)] backdrop-blur-sm transition hover:bg-white/80 disabled:pointer-events-none disabled:opacity-0";
const ARROW_ICON_SIZE = 13;

function ExtractIcon() {
	return (
		<svg
			width="14"
			height="14"
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

type PostCardProps = {
	post: Post;
	/**
	 * 사진·댓글 공통 핸들러 (PostCardSheet용).
	 * onOpenPhoto / onOpenComments가 있으면 그쪽을 우선한다.
	 */
	onOpen?: (post: Post) => void;
	/** 사진 클릭 — 커뮤니티처럼 이미 상세를 보는 중이면 생략 가능 */
	onOpenPhoto?: (post: Post) => void;
	/** 댓글 아이콘 클릭 */
	onOpenComments?: (post: Post) => void;
};

export default function PostCard({
	post,
	onOpen,
	onOpenPhoto,
	onOpenComments,
}: PostCardProps) {
	const openPhoto = onOpenPhoto ?? onOpen;
	const openComments = onOpenComments ?? onOpen;
	const [isMenuOpen, setMenuOpen] = useState(false);
	const [isReportOpen, setReportOpen] = useState(false);
	const [isEditOpen, setEditOpen] = useState(false);
	const [isDeleteOpen, setDeleteOpen] = useState(false);
	const [isShareOpen, setShareOpen] = useState(false);
	const [showArchiveFull, setShowArchiveFull] = useState(false);
	const [imageIndex, setImageIndex] = useState(0);
	const menuRef = useRef<HTMLDivElement>(null);
	const { requireAuth } = useRequireAuth();

	const isHidden = usePostHiddenOverlay(post.id);

	// 좋아요·북마크는 요청 중에도 계속 누를 수 있다 (화면은 즉시, 요청은 디바운스)
	const { toggle: toggleLike } = useTogglePostLike();
	const { toggle: toggleBookmark } = useTogglePostBookmark();
	const { mutate: deletePostMutate, isPending: isDeletePending } =
		useDeletePost();
	const { mutate: hidePostMutate, isPending: isHidePending } = useHidePost();
	const {
		mutate: loadStoredDesign,
		data: storedDesignResult,
		isPending: isDesignLoading,
		error: designLoadError,
		reset: resetStoredDesign,
	} = useDesignExtractMutation();
	const { isFull: isArchiveFull, hasTattoo } = useArchiveCapacity();

	const { isLiked, isBookmarked } = usePostEngagement(post);

	const { nickname, avatarUrl, profileTo, isMine } = useAuthorDisplay(
		post.author,
	);

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

	const handleEdit = () => {
		setMenuOpen(false);
		if (!requireAuth()) return;
		setEditOpen(true);
	};

	const handleDelete = () => {
		setMenuOpen(false);
		if (!requireAuth()) return;
		setDeleteOpen(true);
	};

	const confirmDelete = () => {
		deletePostMutate(post.id, {
			onSuccess: () => setDeleteOpen(false),
			onError: (err) => {
				window.alert(
					err instanceof ApiError ? err.message : "삭제에 실패했습니다.",
				);
			},
		});
	};

	const handleBlock = () => {
		setMenuOpen(false);
		if (!requireAuth() || isHidden || isHidePending) return;
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

	const handleUnhide = () => {
		if (!requireAuth()) return;
		hidePostMutate(
			{ postId: post.id, hidden: true },
			{
				onError: (err) => {
					window.alert(
						err instanceof ApiError
							? err.message
							: "숨김 취소에 실패했습니다.",
					);
				},
			},
		);
	};

	const handleReport = () => {
		setMenuOpen(false);
		if (!requireAuth()) return;
		setReportOpen(true);
	};

	const imageUrls = getPostImageUrls(post);
	const safeIndex =
		imageUrls.length === 0 ? 0 : Math.min(imageIndex, imageUrls.length - 1);
	const hasMultipleImages = imageUrls.length > 1;
	const currentTattooSeq = post.imageTattooSeqs?.[safeIndex] ?? null;
	const canExtractDesign =
		!isHidden && imageUrls[safeIndex] != null && currentTattooSeq != null;
	const { handlers: swipeHandlers, trackStyle } = useImageSwipe({
		count: imageUrls.length,
		index: safeIndex,
		onIndexChange: setImageIndex,
		enabled: !isHidden,
	});

	return (
		<article className="w-full overflow-hidden rounded-[12px] bg-white pb-4 lg:overflow-visible lg:rounded-none lg:bg-transparent lg:pb-0">
			<div className="flex items-center gap-3 px-3 py-3 lg:px-0 lg:py-0">
				<Link to={profileTo} aria-label={`${nickname} 프로필`}>
					<img
						src={avatarUrl}
						alt=""
						className={`size-9 shrink-0 rounded-full transition hover:opacity-90 ${avatarImageClassName(avatarUrl)}`}
					/>
				</Link>
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<Link
						to={profileTo}
						className="truncate text-[14px] font-semibold text-black hover:underline">
						{nickname}
					</Link>
					{post.author.isArtist && <ArtistBadge size={16} />}
					<span className="shrink-0 text-[12px] font-light text-black/40">
						{formatTimeAgo(post.createdAt)}
					</span>
				</div>
				<div className="relative" ref={menuRef}>
					{!isHidden && (
						<>
							<button
								type="button"
								aria-label="게시물 메뉴"
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
													게시물 내용을 수정합니다
												</span>
											</button>
											<button
												type="button"
												onClick={handleDelete}
												disabled={isDeletePending}
												className="block w-full whitespace-nowrap border-t border-black/5 px-4 py-2.5 text-left text-[13px] text-brand transition hover:bg-black/5 disabled:opacity-50">
												삭제
												<span className="mt-0.5 block text-[11px] font-light text-black/40">
													이 게시물을 삭제합니다
												</span>
											</button>
										</>
									) : (
										<>
											<button
												type="button"
												onClick={handleReport}
												className="block w-full whitespace-nowrap px-4 py-2.5 text-left text-[13px] text-black transition hover:bg-black/5">
												신고
												<span className="mt-0.5 block text-[11px] font-light text-black/40">
													건전한 커뮤니티
												</span>
											</button>
											<button
												type="button"
												onClick={handleBlock}
												disabled={isHidePending}
												className="block w-full whitespace-nowrap px-4 py-2.5 text-left text-[13px] text-brand transition hover:bg-black/5 disabled:opacity-50">
												숨기기
												<span className="mt-0.5 block text-[11px] font-light text-black/40">
													이 게시물을 숨깁니다
												</span>
											</button>
										</>
									)}
								</div>
							)}
						</>
					)}
				</div>
			</div>

			<div className="relative lg:mt-3">
				<div
					className={
						isHidden
							? "pointer-events-none select-none blur-[3px] opacity-40"
							: undefined
					}>
					<div className="group relative">
						{/*
						  사진을 누르면 상세/댓글로 들어간다. 넘기려다 잘못 열리는 일은
						  useImageSwipe가 막는다 — 드래그로 끝난 입력은 onClickCapture에서
						  클릭을 취소하므로, 탭일 때만 여기까지 온다.
						  openPhoto가 없으면(커뮤니티 피드) 사진 클릭으로 댓글 창을 열지 않는다.
						*/}
						{openPhoto ? (
							<button
								type="button"
								onClick={() => !isHidden && openPhoto(post)}
								disabled={isHidden}
								{...swipeHandlers}
								className="block w-full overflow-hidden disabled:cursor-default lg:rounded-[10px]"
								aria-label="게시물 상세 보기">
								{imageUrls.length > 0 ? (
									<div className="flex" style={trackStyle}>
										{imageUrls.map((url, index) => (
											<img
												key={`${url}-${index}`}
												src={url}
												alt={`${post.author.nickname}의 게시물 ${index + 1}`}
												draggable={false}
												className={`aspect-[3/4] h-auto w-full shrink-0 object-cover ${
													hasMultipleImages ? "" : "transition hover:scale-[1.01]"
												}`}
											/>
										))}
									</div>
								) : (
									<div className="aspect-[3/4] w-full bg-[#D9D9D9]" />
								)}
							</button>
						) : (
							<div
								{...swipeHandlers}
								className="block w-full overflow-hidden lg:rounded-[10px]">
								{imageUrls.length > 0 ? (
									<div className="flex" style={trackStyle}>
										{imageUrls.map((url, index) => (
											<img
												key={`${url}-${index}`}
												src={url}
												alt={`${post.author.nickname}의 게시물 ${index + 1}`}
												draggable={false}
												className="aspect-[3/4] h-auto w-full shrink-0 object-cover"
											/>
										))}
									</div>
								) : (
									<div className="aspect-[3/4] w-full bg-[#D9D9D9]" />
								)}
							</div>
						)}

						{hasMultipleImages && !isHidden && (
							<>
								<button
									type="button"
									aria-label="이전 사진"
									disabled={safeIndex === 0}
									onClick={() => setImageIndex((i) => Math.max(0, i - 1))}
									className={`${ARROW_BUTTON_CLASS} left-2`}>
									<ChevronIcon direction="left" size={ARROW_ICON_SIZE} />
								</button>
								<button
									type="button"
									aria-label="다음 사진"
									disabled={safeIndex === imageUrls.length - 1}
									onClick={() =>
										setImageIndex((i) => Math.min(imageUrls.length - 1, i + 1))
									}
									className={`${ARROW_BUTTON_CLASS} right-2`}>
									<ChevronIcon direction="right" size={ARROW_ICON_SIZE} />
								</button>
								<span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
									{safeIndex + 1} / {imageUrls.length}
								</span>
							</>
						)}

						{/* 모바일·태블릿 상시, lg+ 호버 — 카드에서도 도안 추출 가능 */}
						{canExtractDesign && currentTattooSeq != null && (
							<button
								type="button"
								aria-label="도안 추출"
								disabled={isDesignLoading}
								onClick={(e) => {
									e.stopPropagation();
									if (!requireAuth()) return;
									if (isArchiveFull && !hasTattoo(currentTattooSeq)) {
										setShowArchiveFull(true);
										return;
									}
									loadStoredDesign(currentTattooSeq);
								}}
								className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-[12px] font-semibold text-black opacity-100 backdrop-blur-sm transition-opacity duration-200 hover:bg-white/90 disabled:cursor-wait disabled:opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
								{isDesignLoading ? (
									<>
										<span
											aria-hidden="true"
											className="size-3 animate-spin rounded-full border-2 border-black/20 border-t-black"
										/>
										추출 중...
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
							<p className="absolute bottom-14 right-3 z-10 max-w-[70%] rounded-lg bg-black/60 px-2.5 py-1 text-[11px] font-light text-white">
								{designLoadError instanceof Error
									? designLoadError.message
									: "도안 추출에 실패했습니다."}
							</p>
						)}
					</div>

					{hasMultipleImages && (
						<div className="mt-2 flex items-center justify-center">
							{imageUrls.map((_, index) => (
								<button
									key={index}
									type="button"
									aria-label={`${index + 1}번째 사진 보기`}
									aria-current={index === safeIndex}
									disabled={isHidden}
									onClick={() => setImageIndex(index)}
									className="flex size-4 items-center justify-center">
									<span
										className={`size-1.5 rounded-full transition ${
											index === safeIndex
												? "bg-brand"
												: "bg-black/20 hover:bg-black/40"
										}`}
									/>
								</button>
							))}
						</div>
					)}

					<div className="mt-3 flex items-center gap-4 px-3 text-black lg:px-0">
						<button
							type="button"
							aria-label="좋아요"
							disabled={isHidden}
							onClick={() => requireAuth(() => toggleLike(post.id, isLiked))}
							className={`flex items-center gap-1.5 transition disabled:opacity-50 ${
								isLiked ? "text-brand" : "hover:text-black/60"
							}`}>
							<HeartIcon filled={isLiked} />
							<span className="text-[13px] font-light">{post.likeCount}</span>
						</button>
						<button
							type="button"
							aria-label="댓글 보기"
							onClick={() => !isHidden && openComments?.(post)}
							disabled={isHidden || !openComments}
							className="flex items-center gap-1.5 transition hover:text-black/60 disabled:opacity-50">
							<CommentIcon />
							<span className="text-[13px] font-light">{post.commentCount}</span>
						</button>
						<button
							type="button"
							aria-label="공유"
							disabled={isHidden}
							onClick={() => requireAuth(() => setShareOpen(true))}
							className="transition hover:text-black/60 disabled:opacity-50">
							<ShareIcon />
						</button>
						<button
							type="button"
							aria-label="북마크"
							disabled={isHidden}
							onClick={() =>
								requireAuth(() => toggleBookmark(post.id, isBookmarked))
							}
							className={`ml-auto transition disabled:opacity-50 ${
								isBookmarked ? "text-brand" : "hover:text-black/60"
							}`}>
							<BookmarkIcon filled={isBookmarked} />
						</button>
					</div>

					{openComments ? (
						<button
							type="button"
							aria-label="댓글 보기"
							disabled={isHidden}
							onClick={() => openComments(post)}
							className="mt-2 block w-full px-3 text-left text-[13px] font-light leading-5 text-black disabled:opacity-50 lg:px-0">
							<span className="line-clamp-2">
								<span className="font-semibold">{nickname}</span>
								{post.author.isArtist && (
									<ArtistBadge
										size={13}
										className="mx-1 inline-block align-[-2px]"
									/>
								)}
								<span className="ml-2">{post.caption}</span>
							</span>
						</button>
					) : (
						<p className="mt-2 line-clamp-2 px-3 text-[13px] font-light leading-5 text-black lg:px-0">
							<Link
								to={profileTo}
								className="font-semibold hover:underline"
								tabIndex={isHidden ? -1 : undefined}>
								{nickname}
							</Link>
							{post.author.isArtist && (
								<ArtistBadge
									size={13}
									className="mx-1 inline-block align-[-2px]"
								/>
							)}
							<span className="ml-2">{post.caption}</span>
						</p>
					)}
				</div>

				{isHidden && (
					<HiddenPostOverlay
						onUnhide={handleUnhide}
						isPending={isHidePending}
					/>
				)}
			</div>

			<DesignExtractResultModal
				result={storedDesignResult ?? null}
				onClose={resetStoredDesign}
			/>
			<ArchiveFullModal
				isOpen={showArchiveFull}
				onClose={() => setShowArchiveFull(false)}
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
				imageUrl={post.imageUrl}
				onClose={() => setDeleteOpen(false)}
				onConfirm={confirmDelete}
				isPending={isDeletePending}
			/>
			<SharePostModal
				post={isShareOpen ? post : null}
				onClose={() => setShareOpen(false)}
			/>
		</article>
	);
}
