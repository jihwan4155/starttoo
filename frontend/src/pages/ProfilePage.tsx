import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ArtistBadge from "../components/common/ArtistBadge";
import PostDetailModal from "../components/community/PostDetailModal";
import MyPageEmptyState from "../components/mypage/MyPageEmptyState";
import PostThumbnailGrid from "../components/mypage/PostThumbnailGrid";
import { MOCK_EXPLORE_POSTS, MOCK_POSTS } from "../mocks/community";
import { MOCK_ARTISTS } from "../mocks/artists";
import useCommunityStore from "../store/useCommunityStore";
import useUserStore from "../store/useUserStore";
import type { Post } from "../types/community";
import { resolveAvatar } from "../utils/profile";

/** 닉네임 기반 유사 난수 (팔로워 수 등 목업 표시가 매번 바뀌지 않도록 고정) */
function seededCount(nickname: string, base: number, span: number): number {
	const sum = [...nickname].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
	return base + (sum % span);
}

/** 상대방 상세 프로필 — 프로필 이미지/이름 클릭 시 이동 (TODO: GET /users/{nickname} 연동) */
export default function ProfilePage() {
	const navigate = useNavigate();
	const { nickname: rawNickname } = useParams();
	const nickname = decodeURIComponent(rawNickname ?? "");
	const [activePost, setActivePost] = useState<Post | null>(null);

	const myNickname = useUserStore((s) => s.nickname);
	const myPosts = useCommunityStore((s) => s.myPosts);

	const artist = useMemo(
		() => MOCK_ARTISTS.find((a) => a.name === nickname) ?? null,
		[nickname],
	);

	// 이 사용자가 작성한 게시글 모으기 (내 프로필이면 내가 올린 글도 포함)
	const posts = useMemo(() => {
		const pool =
			nickname === myNickname
				? [...myPosts, ...MOCK_POSTS, ...MOCK_EXPLORE_POSTS]
				: [...MOCK_POSTS, ...MOCK_EXPLORE_POSTS];
		const seen = new Set<number>();
		return pool.filter((post) => {
			if (post.author.nickname !== nickname || seen.has(post.id)) return false;
			seen.add(post.id);
			return true;
		});
	}, [nickname, myNickname, myPosts]);

	const isArtist = !!artist || posts.some((post) => post.author.isArtist);
	const avatarUrl = resolveAvatar(undefined, nickname);
	const [following, setFollowing] = useState(false);

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface px-6 pb-16 pt-6">
			<div className="mx-auto w-full max-w-[900px]">
				<button
					type="button"
					onClick={() => navigate(-1)}
					className="mb-6 flex items-center gap-1 text-[14px] font-light text-black/50 transition hover:text-black">
					<span aria-hidden>←</span> 뒤로
				</button>

				{/* 프로필 헤더 */}
				<div className="flex items-end justify-between">
					<div className="flex items-center gap-6">
						<img
							src={avatarUrl}
							alt={`${nickname}의 프로필 이미지`}
							className="size-[100px] shrink-0 rounded-full bg-[#D9D9D9] object-cover"
						/>
						<div className="min-w-0">
							<p className="flex items-center gap-2 text-[22px] font-bold text-black">
								<span className="truncate">{nickname}</span>
								{isArtist && <ArtistBadge size={18} />}
							</p>
							<div className="mt-2 flex items-center gap-4 text-[15px] font-light text-black/60">
								<span>게시물 {posts.length}</span>
								<span>팔로워 {seededCount(nickname, 120, 880)}명</span>
								<span>팔로잉 {seededCount(nickname, 60, 340)}명</span>
							</div>
							{artist && (
								<p className="mt-1 truncate text-[13px] font-light text-black/45">
									{artist.isOpen ? "영업 중" : "영업 종료"}
									<span className="mx-1.5">·</span>
									{artist.hoursLabel}
									<span className="mx-1.5">·</span>
									{artist.address}
								</p>
							)}
						</div>
					</div>

					{/* TODO: 팔로우 API 연동 */}
					<button
						type="button"
						onClick={() => setFollowing((v) => !v)}
						className={`h-[42px] shrink-0 rounded-full px-7 text-[14px] font-semibold transition ${
							following
								? "border border-black/15 bg-white text-black/60 hover:bg-black/5"
								: "bg-brand text-white hover:brightness-95"
						}`}>
						{following ? "팔로잉" : "팔로우"}
					</button>
				</div>

				{/* 타투이스트 장르 태그 */}
				{artist && artist.categories.length > 0 && (
					<div className="mt-6 flex flex-wrap gap-1.5">
						{artist.categories.map((category) => (
							<span
								key={category}
								className="rounded-[6px] bg-[#1A1A1A] px-2.5 py-1 text-[12px] font-medium text-white">
								{category}
							</span>
						))}
					</div>
				)}

				{/* 게시글 그리드 */}
				<div className="mt-8">
					{posts.length === 0 ? (
						<MyPageEmptyState message="게시글이 없습니다" />
					) : (
						<PostThumbnailGrid posts={posts} onOpen={setActivePost} />
					)}
				</div>
			</div>

			<PostDetailModal
				key={activePost?.id}
				post={activePost}
				onClose={() => setActivePost(null)}
			/>
		</div>
	);
}
