import { useState } from "react";
import { Link } from "react-router-dom";
import {
	BookmarkIcon,
	CommentIcon,
	HeartIcon,
	MoreIcon,
	ShareIcon,
} from "./icons";
import ArtistBadge from "../common/ArtistBadge";
import useCommunityStore from "../../store/useCommunityStore";
import useAuthorDisplay from "../../hooks/useAuthorDisplay";
import { formatTimeAgo } from "../../utils/timeAgo";
import type { Post } from "../../types/community";

type PostCardProps = {
	post: Post;
	onOpen: (post: Post) => void;
};

export default function PostCard({ post, onOpen }: PostCardProps) {
	const [isMenuOpen, setMenuOpen] = useState(false);
	// 좋아요·북마크는 상세 모달과 동기화되도록 전역 스토어 사용
	const isLiked = useCommunityStore((s) => !!s.liked[post.id]);
	const isBookmarked = useCommunityStore((s) => !!s.bookmarked[post.id]);
	const toggleLike = useCommunityStore((s) => s.toggleLike);
	const toggleBookmark = useCommunityStore((s) => s.toggleBookmark);
	// 상세 모달에서 작성한 댓글 수를 피드 카운트에 반영
	const myCommentCount = useCommunityStore(
		(s) => s.extraComments[post.id]?.length ?? 0,
	);
	const { nickname, avatarUrl, profileTo } = useAuthorDisplay(post.author);

	return (
		<article className="w-full">
			{/* 작성자 헤더 */}
			<div className="flex items-center gap-3">
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
				<div className="relative">
					<button
						type="button"
						aria-label="게시글 메뉴"
						onClick={() => setMenuOpen((prev) => !prev)}
						className="flex size-8 items-center justify-center rounded-full text-black/60 transition hover:bg-black/5">
						<MoreIcon size={20} />
					</button>
					{isMenuOpen && (
						<div className="absolute right-0 top-9 z-20 w-[120px] overflow-hidden rounded-[10px] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
							{/* TODO: 신고/차단 API 연동 */}
							<button
								type="button"
								onClick={() => setMenuOpen(false)}
								className="block w-full px-4 py-2.5 text-left text-[13px] text-black transition hover:bg-black/5">
								신고
								<span className="mt-0.5 block text-[11px] font-light text-black/40">
									건전한 커뮤니티
								</span>
							</button>
							<button
								type="button"
								onClick={() => setMenuOpen(false)}
								className="block w-full px-4 py-2.5 text-left text-[13px] text-brand transition hover:bg-black/5">
								차단
								<span className="mt-0.5 block text-[11px] font-light text-black/40">
									이 사용자 게시글 숨기기
								</span>
							</button>
						</div>
					)}
				</div>
			</div>

			{/* 이미지 */}
			<button
				type="button"
				onClick={() => onOpen(post)}
				className="mt-3 block w-full overflow-hidden rounded-[10px]"
				aria-label="게시글 상세 보기">
				{/* 높이를 뷰포트에 연동해 첫 화면에서 다음 게시물 사진이 살짝 보이도록 */}
				{post.imageUrl ? (
					<img
						src={post.imageUrl}
						alt={`${post.author.nickname}의 게시글`}
						className="h-[clamp(320px,52vh,460px)] w-full object-cover transition hover:scale-[1.01]"
					/>
				) : (
					<div className="h-[clamp(320px,52vh,460px)] w-full bg-[#D9D9D9]" />
				)}
			</button>

			{/* 액션 바 */}
			<div className="mt-3 flex items-center gap-4 text-black">
				<button
					type="button"
					aria-label="좋아요"
					onClick={() => toggleLike(post.id)}
					className={`flex items-center gap-1.5 transition ${
						isLiked ? "text-brand" : "hover:text-black/60"
					}`}>
					<HeartIcon filled={isLiked} />
					<span className="text-[13px] font-light">
						{post.likeCount + (isLiked ? 1 : 0)}
					</span>
				</button>
				<button
					type="button"
					aria-label="댓글 보기"
					onClick={() => onOpen(post)}
					className="flex items-center gap-1.5 transition hover:text-black/60">
					<CommentIcon />
					<span className="text-[13px] font-light">
						{post.commentCount + myCommentCount}
					</span>
				</button>
				<button
					type="button"
					aria-label="공유"
					className="transition hover:text-black/60">
					<ShareIcon />
				</button>
				<button
					type="button"
					aria-label="북마크"
					onClick={() => toggleBookmark(post.id)}
					className={`ml-auto transition ${
						isBookmarked ? "text-brand" : "hover:text-black/60"
					}`}>
					<BookmarkIcon filled={isBookmarked} />
				</button>
			</div>

			{/* 캡션 */}
			<p className="mt-2 line-clamp-2 text-[13px] font-light leading-5 text-black">
				<Link to={profileTo} className="mr-2 font-semibold hover:underline">
					{nickname}
				</Link>
				{post.caption}
			</p>
		</article>
	);
}
