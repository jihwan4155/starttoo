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
import ReportPostModal from "./ReportPostModal";
import EditPostModal from "./EditPostModal";
import DeletePostModal from "./DeletePostModal";
import SharePostModal from "./SharePostModal";
import HiddenPostOverlay from "./HiddenPostOverlay";
import useDeletePost from "../../hooks/mutations/useDeletePost";
import useHidePost from "../../hooks/mutations/useHidePost";
import useTogglePostBookmark from "../../hooks/mutations/useTogglePostBookmark";
import useTogglePostLike from "../../hooks/mutations/useTogglePostLike";
import useAuthorDisplay from "../../hooks/useAuthorDisplay";
import usePostEngagement from "../../hooks/usePostEngagement";
import useRequireAuth from "../../hooks/useRequireAuth";
import usePostHiddenOverlay from "../../hooks/usePostHidden";
import { ApiError } from "../../services/api";
import { getPostImageUrls } from "../../utils/mapPost";
import { formatTimeAgo } from "../../utils/timeAgo";
import type { Post } from "../../types/community";

type PostCardProps = {
	post: Post;
	onOpen: (post: Post) => void;
};

export default function PostCard({ post, onOpen }: PostCardProps) {
	const [isMenuOpen, setMenuOpen] = useState(false);
	const [isReportOpen, setReportOpen] = useState(false);
	const [isEditOpen, setEditOpen] = useState(false);
	const [isDeleteOpen, setDeleteOpen] = useState(false);
	const [isShareOpen, setShareOpen] = useState(false);
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
	const currentImageUrl = imageUrls[safeIndex] ?? null;
	const hasMultipleImages = imageUrls.length > 1;

	return (
		<article className="w-full overflow-hidden rounded-[12px] bg-white pb-4 lg:overflow-visible lg:rounded-none lg:bg-transparent lg:pb-0">
			<div className="flex items-center gap-3 px-3 py-3 lg:px-0 lg:py-0">
				<Link to={profileTo} aria-label={`${nickname} 프로필`}>
					<img
						src={avatarUrl}
						alt=""
						className="size-9 shrink-0 rounded-full bg-[#D9D9D9] object-cover transition hover:opacity-90"
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
												disabled={isDeletePending}
												className="block w-full whitespace-nowrap border-t border-black/5 px-4 py-2.5 text-left text-[13px] text-brand transition hover:bg-black/5 disabled:opacity-50">
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
													이 게시글을 숨깁니다
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
					<div className="relative">
						<button
							type="button"
							onClick={() => !isHidden && onOpen(post)}
							disabled={isHidden}
							className="block w-full overflow-hidden disabled:cursor-default lg:rounded-[10px]"
							aria-label="게시글 상세 보기">
							{currentImageUrl ? (
								<img
									src={currentImageUrl}
									alt={`${post.author.nickname}의 게시글 ${safeIndex + 1}`}
									className="aspect-[3/4] h-auto w-full object-cover transition hover:scale-[1.01]"
								/>
							) : (
								<div className="aspect-[3/4] w-full bg-[#D9D9D9]" />
							)}
						</button>

						{hasMultipleImages && !isHidden && (
							<>
								<button
									type="button"
									aria-label="이전 사진"
									disabled={safeIndex === 0}
									onClick={() => setImageIndex((i) => Math.max(0, i - 1))}
									className="absolute left-2 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-black shadow-[0_2px_8px_rgba(0,0,0,0.15)] backdrop-blur-sm transition hover:bg-white disabled:pointer-events-none disabled:opacity-0">
									<ChevronIcon direction="left" size={16} />
								</button>
								<button
									type="button"
									aria-label="다음 사진"
									disabled={safeIndex === imageUrls.length - 1}
									onClick={() =>
										setImageIndex((i) => Math.min(imageUrls.length - 1, i + 1))
									}
									className="absolute right-2 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-black shadow-[0_2px_8px_rgba(0,0,0,0.15)] backdrop-blur-sm transition hover:bg-white disabled:pointer-events-none disabled:opacity-0">
									<ChevronIcon direction="right" size={16} />
								</button>
								<span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
									{safeIndex + 1} / {imageUrls.length}
								</span>
							</>
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
							onClick={() => !isHidden && onOpen(post)}
							disabled={isHidden}
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

					<p className="mt-2 line-clamp-2 px-3 text-[13px] font-light leading-5 text-black lg:px-0">
						<Link
							to={profileTo}
							className="mr-2 font-semibold hover:underline"
							tabIndex={isHidden ? -1 : undefined}>
							{nickname}
						</Link>
						{post.caption}
					</p>
				</div>

				{isHidden && (
					<HiddenPostOverlay
						onUnhide={handleUnhide}
						isPending={isHidePending}
					/>
				)}
			</div>

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
