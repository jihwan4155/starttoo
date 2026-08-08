import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import CollectionPreview from "../components/collections/CollectionPreview";
import ArtistBadge from "../components/common/ArtistBadge";
import { isVerifiedArtist } from "../utils/artistStatus";
import UnfollowConfirmModal from "../components/common/UnfollowConfirmModal";
import PostCardSheet from "../components/community/PostCardSheet";
import PostDetailModal from "../components/community/PostDetailModal";
import StarttooLoader from "../components/loader/StarttooLoader";
import FollowListModal from "../components/mypage/FollowListModal";
import MyPageEmptyState from "../components/mypage/MyPageEmptyState";
import MyPageShopInfo from "../components/mypage/MyPageShopInfo";
import PostThumbnailGrid from "../components/mypage/PostThumbnailGrid";
import ProfileMoreMenu from "../components/profile/ProfileMoreMenu";
import ProfileTabs, { type ProfileTab } from "../components/profile/ProfileTabs";
import { useCreateDmRoom } from "../hooks/mutations/useDmMutations";
import type { FollowListKind } from "../hooks/queries/useFollowList";
import useToggleFollow from "../hooks/mutations/useToggleFollow";
import useUserCollections from "../hooks/queries/useUserCollections";
import useUserPosts from "../hooks/queries/useUserPosts";
import useUserProfile from "../hooks/queries/useUserProfile";
import useArtistProfile from "../hooks/queries/useArtistProfile";
import { useIsMobile } from "../hooks/useIsMobile";
import useRequireAuth from "../hooks/useRequireAuth";
import { ApiError } from "../services/api";
import useAuthStore from "../store/useAuthStore";
import useDmStore from "../store/useDmStore";
import type { Post } from "../types/community";
import { resolveAvatar } from "../utils/profile";

/** 상대방 프로필 — GET /users/{userId} + GET /users/{userId}/posts */
export default function ProfilePage() {
	const navigate = useNavigate();
	const { userId: rawUserId } = useParams();
	const userId = Number(rawUserId);
	const [activePost, setActivePost] = useState<Post | null>(null);
	// 모바일에서 썸네일을 눌렀을 때 먼저 뜨는 카드 화면 (댓글은 그 다음 단계).
	// ID로 들고 있어서 피드가 삭제되어 목록에서 빠지면 저절로 닫힌다.
	const [cardPostId, setCardPostId] = useState<number | null>(null);
	const [isUnfollowOpen, setUnfollowOpen] = useState(false);
	const [tab, setTab] = useState<ProfileTab>("feed");
	// null이면 닫힘 — 어느 탭으로 열지까지 이 값이 들고 있다.
	const [followListKind, setFollowListKind] = useState<FollowListKind | null>(
		null,
	);
	const { requireAuth } = useRequireAuth();
	// sm(640px) 미만 — 상세 모달이 사진 칸을 접는 구간과 같은 경계
	const isMobile = useIsMobile(639);
	const openDmRoom = useDmStore((s) => s.openRoom);
	// isMe와 같은 출처 — 프로필 조회를 기다리지 않고 바로 판단할 수 있다.
	const myUserId = useAuthStore((s) => s.user?.userId);

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

	const cardPost = useMemo(
		() =>
			cardPostId == null
				? null
				: posts.find((post) => post.id === cardPostId) ?? null,
		[cardPostId, posts],
	);

	/**
	 * 썸네일을 눌렀을 때. 모바일은 커뮤니티 카드와 같은 화면을 한 번 거치고,
	 * 넓은 화면은 사진·댓글을 나란히 보여주는 상세 모달을 바로 연다.
	 */
	const handleOpenPost = (post: Post) => {
		if (isMobile) {
			setCardPostId(post.id);
			return;
		}
		setActivePost(post);
	};

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
	/** 뱃지는 인증(VERIFIED)까지 끝난 타투이스트에게만 붙는다 */
	const showArtistBadge = isVerifiedArtist(
		profile?.role,
		profile?.artist?.verificationStatus,
	);
	const {
		data: artistDetail,
		isPending: isArtistDetailPending,
	} = useArtistProfile(userId, Boolean(isArtist));
	const avatarUrl = resolveAvatar(profile?.profileImageUrl, profile?.nickname);
	const usesDefaultAvatar = !profile?.profileImageUrl;
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

	/**
	 * 차단 직후 — 이 프로필은 서버가 USER_NOT_FOUND로 막으므로 화면에 남아 있으면
	 * 다음 조회가 오류로 뜬다. 히스토리를 대체해 뒤로 가기로도 돌아오지 않게 한다.
	 * 프로필은 게시물 목록에서 들어오는 화면이라 그 목록으로 돌려보낸다.
	 */
	const handleBlocked = () => {
		navigate("/posts", { replace: true });
	};

	if (!Number.isFinite(userId) || userId <= 0) {
		return (
			<div className="min-h-[calc(100vh-var(--nav-h))] bg-surface px-6 pb-16 pt-6">
				<MyPageEmptyState message="잘못된 프로필 주소입니다" />
			</div>
		);
	}

	/*
	 * 내 계정이면 마이페이지가 정식 화면이다.
	 *
	 * 팔로우 목록·커뮤니티 작성자·타투이스트 목록·DM 등 /profile/{id}로 보내는 곳이
	 * 여러 군데라, 각 호출부를 고치는 대신 여기서 한 번에 넘긴다. replace로 바꿔서
	 * 뒤로 가기가 이 경로를 다시 밟지 않게 한다.
	 */
	if (myUserId != null && myUserId === userId) {
		return <Navigate to="/mypage" replace />;
	}

	return (
		<div className="min-h-[calc(100vh-var(--nav-h))] bg-surface px-0 pb-28 pt-5 lg:px-6 lg:pb-16 lg:pt-6">
			<div className="mx-auto w-full max-w-[900px]">
				<button
					type="button"
					onClick={() => navigate(-1)}
					className="mb-5 ml-4 flex items-center gap-1 text-[14px] font-light text-black/50 transition hover:text-black lg:mb-6 lg:ml-0">
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
						<div className="mx-4 flex flex-col gap-4 rounded-[12px] bg-white p-4 lg:mx-0 lg:flex-row lg:items-end lg:justify-between lg:rounded-none lg:bg-transparent lg:p-0">
							<div className="flex items-center gap-4 lg:gap-6">
								<img
									src={avatarUrl}
									alt={`${profile.nickname}의 프로필 이미지`}
									className={`size-[48px] shrink-0 rounded-full lg:size-[84px] ${usesDefaultAvatar ? "bg-white object-contain" : "bg-white object-cover"}`}
								/>
								<div className="min-w-0">
									<p className="flex items-center gap-2 text-[18px] font-bold text-black lg:text-[22px]">
										<span className="truncate">{profile.nickname}</span>
										{showArtistBadge && <ArtistBadge size={18} />}
									</p>
									<div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-light text-black/55 lg:mt-2 lg:text-[15px] lg:text-black/60">
										<span>게시물 {posts.length}</span>
										<button
											type="button"
											onClick={() => setFollowListKind("followers")}
											className="rounded transition hover:text-black">
											팔로워 {profile.followerCount.toLocaleString()}명
										</button>
										<button
											type="button"
											onClick={() => setFollowListKind("following")}
											className="rounded transition hover:text-black">
											팔로우 {profile.followingCount.toLocaleString()}명
										</button>
									</div>
								</div>
							</div>

							{!profile.isMe && (
								<div className="flex w-full shrink-0 flex-col items-end gap-2 lg:w-auto">
									{/* 메시지 보내기 위의 더보기 — 차단은 여기서만 들어간다 */}
									<ProfileMoreMenu
										userId={profile.userId}
										nickname={profile.nickname}
										onBlocked={handleBlocked}
									/>
									<div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto lg:items-center">
										<button
											type="button"
											onClick={handleFollow}
											disabled={isFollowPending}
											className={`h-10 rounded-full px-4 text-[13px] font-semibold transition disabled:opacity-50 lg:h-[42px] lg:px-7 lg:text-[14px] ${
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
											className="h-10 whitespace-nowrap rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition hover:brightness-95 disabled:opacity-50 lg:h-[42px] lg:px-6 lg:text-[14px]">
											{isCreatingDmRoom ? "이동 중…" : "메시지 보내기"}
										</button>
									</div>
								</div>
							)}
						</div>

						{isArtist && (
							<MyPageShopInfo
								artist={profile.artist}
								detail={artistDetail ?? null}
								isLoading={isProfilePending || isArtistDetailPending}
							/>
						)}

						<div className="mt-8">
							<ProfileTabs active={tab} onChange={setTab} />
						</div>

						<div className="mt-4 lg:mt-8">
							{tab === "feed" ? (
								<>
									{isPostsPending && (
										<StarttooLoader
											variant="block"
											size={180}
											label="게시물을 불러오는 중…"
										/>
									)}
									{isPostsError && (
										<MyPageEmptyState message="게시물을 불러오지 못했습니다" />
									)}
									{!isPostsPending && !isPostsError && posts.length === 0 && (
										<MyPageEmptyState message="게시물이 없습니다" />
									)}
									{!isPostsPending && posts.length > 0 && (
										<PostThumbnailGrid posts={posts} onOpen={handleOpenPost} />
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

			<PostCardSheet
				post={cardPost}
				onOpenComments={setActivePost}
				onClose={() => setCardPostId(null)}
			/>

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

			<FollowListModal
				isOpen={followListKind !== null}
				userId={userId}
				kind={followListKind ?? "followers"}
				onChangeKind={setFollowListKind}
				onClose={() => setFollowListKind(null)}
			/>
		</div>
	);
}
