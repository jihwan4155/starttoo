import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ArtistBadge from "../components/common/ArtistBadge";
import UnfollowConfirmModal from "../components/common/UnfollowConfirmModal";
import PostDetailModal from "../components/community/PostDetailModal";
import MyPageEmptyState from "../components/mypage/MyPageEmptyState";
import PostThumbnailGrid from "../components/mypage/PostThumbnailGrid";
import useToggleFollow from "../hooks/mutations/useToggleFollow";
import useUserPosts from "../hooks/queries/useUserPosts";
import useUserProfile from "../hooks/queries/useUserProfile";
import useRequireAuth from "../hooks/useRequireAuth";
import { ApiError } from "../services/api";
import type { Post } from "../types/community";
import { resolveAvatar } from "../utils/profile";

/** 상대방 프로필 — GET /users/{userId} + GET /users/{userId}/posts */
export default function ProfilePage() {
	const navigate = useNavigate();
	const { userId: rawUserId } = useParams();
	const userId = Number(rawUserId);
	const [activePost, setActivePost] = useState<Post | null>(null);
	const [isUnfollowOpen, setUnfollowOpen] = useState(false);
	const { requireAuth } = useRequireAuth();

	const {
		data: profile,
		isPending: isProfilePending,
		isError: isProfileError,
		error: profileError,
	} = useUserProfile(userId);

	const {
		data: postsData,
		isPending: isPostsPending,
		isError: isPostsError,
	} = useUserPosts({ userId, size: 50 });

	const posts = useMemo(
		() => postsData?.pages.flatMap((page) => page.items) ?? [],
		[postsData?.pages],
	);

	const { mutate: toggleFollow, isPending: isFollowPending } =
		useToggleFollow();

	const isArtist = profile?.role === "ARTIST";
	const avatarUrl = resolveAvatar(profile?.profileImageUrl, profile?.nickname);
	const profileErrorMessage =
		profileError instanceof ApiError
			? profileError.message
			: "프로필을 불러오지 못했습니다.";

	const executeFollowToggle = () => {
		if (!profile || profile.isMe) return;
		toggleFollow(
			{ userId: profile.userId, following: profile.isFollowing },
			{
				onSuccess: () => setUnfollowOpen(false),
				onError: (err) => {
					window.alert(
						err instanceof ApiError
							? err.message
							: "팔로우 처리에 실패했습니다.",
					);
				},
			},
		);
	};

	const handleFollow = () => {
		if (!profile || profile.isMe) return;
		requireAuth(() => {
			if (profile.isFollowing) {
				setUnfollowOpen(true);
				return;
			}
			executeFollowToggle();
		});
	};

	if (!Number.isFinite(userId) || userId <= 0) {
		return (
			<div className="min-h-[calc(100vh-60px)] bg-surface px-6 pb-16 pt-6">
				<MyPageEmptyState message="잘못된 프로필 주소입니다" />
			</div>
		);
	}

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface px-6 pb-16 pt-6">
			<div className="mx-auto w-full max-w-[900px]">
				<button
					type="button"
					onClick={() => navigate(-1)}
					className="mb-6 flex items-center gap-1 text-[14px] font-light text-black/50 transition hover:text-black">
					<span aria-hidden>←</span> 뒤로
				</button>

				{isProfilePending && (
					<p className="py-20 text-center text-[14px] text-black/40">
						프로필을 불러오는 중…
					</p>
				)}

				{isProfileError && (
					<MyPageEmptyState message={profileErrorMessage} />
				)}

				{profile && !isProfileError && (
					<>
						<div className="flex items-end justify-between">
							<div className="flex items-center gap-6">
								<img
									src={avatarUrl}
									alt={`${profile.nickname}의 프로필 이미지`}
									className="size-[100px] shrink-0 rounded-full bg-[#D9D9D9] object-cover"
								/>
								<div className="min-w-0">
									<p className="flex items-center gap-2 text-[22px] font-bold text-black">
										<span className="truncate">{profile.nickname}</span>
										{isArtist && <ArtistBadge size={18} />}
									</p>
									<div className="mt-2 flex items-center gap-4 text-[15px] font-light text-black/60">
										<span>게시물 {posts.length}</span>
										<span>팔로워 {profile.followerCount.toLocaleString()}명</span>
										<span>
											팔로잉 {profile.followingCount.toLocaleString()}명
										</span>
									</div>
									{profile.artist?.shopAddress && (
										<p className="mt-1 truncate text-[13px] font-light text-black/45">
											{profile.artist.shopAddress}
										</p>
									)}
								</div>
							</div>

							{!profile.isMe && (
								<button
									type="button"
									onClick={handleFollow}
									disabled={isFollowPending}
									className={`h-[42px] shrink-0 rounded-full px-7 text-[14px] font-semibold transition disabled:opacity-50 ${
										profile.isFollowing
											? "border border-black/15 bg-white text-black/60 hover:bg-black/5"
											: "bg-brand text-white hover:brightness-95"
									}`}>
									{profile.isFollowing ? "팔로잉" : "팔로우"}
								</button>
							)}
						</div>

						<div className="mt-8">
							{isPostsPending && (
								<p className="py-10 text-center text-[14px] text-black/40">
									게시글을 불러오는 중…
								</p>
							)}
							{isPostsError && (
								<MyPageEmptyState message="게시글을 불러오지 못했습니다" />
							)}
							{!isPostsPending && !isPostsError && posts.length === 0 && (
								<MyPageEmptyState message="게시글이 없습니다" />
							)}
							{!isPostsPending && posts.length > 0 && (
								<PostThumbnailGrid posts={posts} onOpen={setActivePost} />
							)}
						</div>
					</>
				)}
			</div>

			<PostDetailModal
				key={activePost?.id}
				post={activePost}
				onClose={() => setActivePost(null)}
			/>

			{profile && (
				<UnfollowConfirmModal
					isOpen={isUnfollowOpen}
					nickname={profile.nickname}
					avatarUrl={avatarUrl}
					onClose={() => setUnfollowOpen(false)}
					onConfirm={executeFollowToggle}
					isPending={isFollowPending}
				/>
			)}
		</div>
	);
}
