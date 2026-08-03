import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CollectionPreview from "../components/collections/CollectionPreview";
import ArtistBadge from "../components/common/ArtistBadge";
import UnfollowConfirmModal from "../components/common/UnfollowConfirmModal";
import PostDetailModal from "../components/community/PostDetailModal";
import StarttooLoader from "../components/loader/StarttooLoader";
import MyPageEmptyState from "../components/mypage/MyPageEmptyState";
import MyPageShopInfo from "../components/mypage/MyPageShopInfo";
import PostThumbnailGrid from "../components/mypage/PostThumbnailGrid";
import ProfileTabs, { type ProfileTab } from "../components/profile/ProfileTabs";
import { useCreateDmRoom } from "../hooks/mutations/useDmMutations";
import useToggleFollow from "../hooks/mutations/useToggleFollow";
import useUserCollections from "../hooks/queries/useUserCollections";
import useUserPosts from "../hooks/queries/useUserPosts";
import useUserProfile from "../hooks/queries/useUserProfile";
import useRequireAuth from "../hooks/useRequireAuth";
import { ApiError } from "../services/api";
import useDmStore from "../store/useDmStore";
import type { Post } from "../types/community";
import { resolveAvatar } from "../utils/profile";

/** 상대방 프로필 — GET /users/{userId} + GET /users/{userId}/posts */
export default function ProfilePage() {
	const navigate = useNavigate();
	const { userId: rawUserId } = useParams();
	const userId = Number(rawUserId);
	const [activePost, setActivePost] = useState<Post | null>(null);
	const [isUnfollowOpen, setUnfollowOpen] = useState(false);
	const [tab, setTab] = useState<ProfileTab>("feed");
	const { requireAuth } = useRequireAuth();
	const openDmRoom = useDmStore((s) => s.openRoom);

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

	const {
		data: placements,
		isPending: isCollectionPending,
		isError: isCollectionError,
	} = useUserCollections(tab === "collection" ? userId : 0);

	const { mutate: toggleFollow, isPending: isFollowPending } =
		useToggleFollow();
	const { mutate: createDmRoom, isPending: isCreatingDmRoom } =
		useCreateDmRoom();

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

	/**
	 * 메시지 보내기 — POST /dm/rooms 로 방을 만들거나 기존 방을 되살린 뒤 DM으로 이동.
	 * 서버가 이 호출을 채팅방 진입으로 보고 안읽음·알림까지 정리해 준다.
	 */
	const handleSendMessage = () => {
		if (!profile || profile.isMe) return;
		requireAuth(() => {
			createDmRoom(profile.userId, {
				onSuccess: (room) => {
					openDmRoom(room.dmRoomSeq);
					navigate("/dm");
				},
				onError: (err) => {
					window.alert(
						err instanceof ApiError
							? err.message
							: "대화를 시작하지 못했습니다.",
					);
				},
			});
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
					<StarttooLoader variant="block" label="프로필을 불러오는 중…" />
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
								</div>
							</div>

							{!profile.isMe && (
								<div className="flex shrink-0 items-center gap-2">
									<button
										type="button"
										onClick={handleFollow}
										disabled={isFollowPending}
										className={`h-[42px] rounded-full px-7 text-[14px] font-semibold transition disabled:opacity-50 ${
											profile.isFollowing
												? "border border-black/15 bg-white text-black/60 hover:bg-black/5"
												: "bg-brand text-white hover:brightness-95"
										}`}>
										{profile.isFollowing ? "팔로우 취소" : "팔로우"}
									</button>
									<button
										type="button"
										onClick={handleSendMessage}
										disabled={isCreatingDmRoom}
										className="h-[42px] whitespace-nowrap rounded-full bg-brand px-6 text-[14px] font-semibold text-white transition hover:brightness-95 disabled:opacity-50">
										{isCreatingDmRoom ? "이동 중…" : "메시지 보내기"}
									</button>
								</div>
							)}
						</div>

						{isArtist && (
							<MyPageShopInfo artist={profile.artist} />
						)}

						<div className="mt-8">
							<ProfileTabs active={tab} onChange={setTab} />
						</div>

						<div className="mt-8">
							{tab === "feed" ? (
								<>
									{isPostsPending && (
										<StarttooLoader
											variant="block"
											size={180}
											label="게시글을 불러오는 중…"
										/>
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
								</>
							) : isCollectionPending ? (
								<StarttooLoader
									variant="block"
									size={180}
									label="컬렉션을 불러오는 중…"
								/>
							) : isCollectionError ? (
								<MyPageEmptyState message="컬렉션을 불러오지 못했습니다" />
							) : (
								// 배치가 없어도 마네킹은 보여준다 (빈 컬렉션도 하나의 상태)
								<CollectionPreview placements={placements ?? []} skin="white" />
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
