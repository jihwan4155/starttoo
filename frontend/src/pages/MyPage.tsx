import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ArchiveFullModal from "../components/common/ArchiveFullModal";
import ImageViewerModal from "../components/common/ImageViewerModal";
import CreatePostModal from "../components/community/CreatePostModal";
import PostCardSheet from "../components/community/PostCardSheet";
import PostDetailModal from "../components/community/PostDetailModal";
import CollectionEditor from "../components/collections/CollectionEditor";
import StarttooLoader from "../components/loader/StarttooLoader";
import ArtistBadgeRequestModal from "../components/mypage/ArtistBadgeRequestModal";
import BlockedListModal from "../components/mypage/BlockedListModal";
import DesignExtractModal from "../components/mypage/DesignExtractModal";
import DesignThumbnailGrid from "../components/mypage/DesignThumbnailGrid";
import FollowListModal from "../components/mypage/FollowListModal";
import MyPageEmptyState from "../components/mypage/MyPageEmptyState";
import MyPageHeader from "../components/mypage/MyPageHeader";
import MyPageShopInfo from "../components/mypage/MyPageShopInfo";
import MyPageTabs, { type MyPageTab } from "../components/mypage/MyPageTabs";
import PostThumbnailGrid from "../components/mypage/PostThumbnailGrid";
import useBookmarkedPosts from "../hooks/queries/useBookmarkedPosts";
import useArchive from "../hooks/queries/useArchive";
import type { FollowListKind } from "../hooks/queries/useFollowList";
import useMe from "../hooks/queries/useMe";
import useMyArtistProfile from "../hooks/queries/useMyArtistProfile";
import useMyPosts from "../hooks/queries/useMyPosts";
import useUserProfile from "../hooks/queries/useUserProfile";
import useRemoveFromArchive from "../hooks/mutations/useRemoveFromArchive";
import { useIsMobile } from "../hooks/useIsMobile";
import useRequireAuth from "../hooks/useRequireAuth";
import useAuthStore from "../store/useAuthStore";
import useUserStore from "../store/useUserStore";
import type { Post } from "../types/community";
import type { SavedDesign } from "../types/designExtract";
import { ApiError } from "../services/api";
import { isVerifiedArtist } from "../utils/artistStatus";
import { MAX_ARCHIVE_DESIGNS } from "../constants/archive";
import { isDemoArchiveDesign } from "../constants/demoArchiveDesigns";
import { mapArchiveItemToSavedDesign } from "../utils/mapArchive";
import mergeWithDemoArchiveDesigns from "../utils/mergeArchiveDesigns";
import { mockPosts } from "../mocks/community";
import { QA_MOCK_DATA_ENABLED } from "../config/qa";

function PlusIcon() {
	return (
		<svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
			<path
				d="M13 4.5v17M4.5 13h17"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function isMyPageTab(value: string | null): value is MyPageTab {
	return (
		value === "feed" ||
		value === "designs" ||
		value === "bookmarks" ||
		value === "collection"
	);
}

/** 마이페이지 — GET /users/me, /users/{me}, /posts/me, /posts/me/bookmarks, /archive */
export default function MyPage() {
	const [searchParams] = useSearchParams();
	const tabParam = searchParams.get("tab");
	const [tab, setTab] = useState<MyPageTab>(
		isMyPageTab(tabParam) ? tabParam : "feed",
	);
	const [isWriteOpen, setWriteOpen] = useState(false);
	const [activePost, setActivePost] = useState<Post | null>(null);
	// 모바일에서 썸네일을 눌렀을 때 먼저 뜨는 카드 화면 (댓글은 그 다음 단계).
	// 피드 객체가 아니라 ID로 들고 있어서, 삭제되어 목록에서 빠지면 저절로 닫힌다.
	const [cardPostId, setCardPostId] = useState<number | null>(null);
	const [activeDesign, setActiveDesign] = useState<SavedDesign | null>(null);
	// null이면 닫힘 — 어느 탭으로 열지까지 이 값이 들고 있다.
	const [followListKind, setFollowListKind] = useState<FollowListKind | null>(
		null,
	);
	const [isBadgeRequestOpen, setBadgeRequestOpen] = useState(false);
	const [isBlockedListOpen, setBlockedListOpen] = useState(false);
	const [isExtractOpen, setExtractOpen] = useState(false);
	const [showArchiveFull, setShowArchiveFull] = useState(false);

	useEffect(() => {
		if (isMyPageTab(tabParam)) {
			setTab(tabParam);
			setActivePost(null);
			setCardPostId(null);
			// 추출 결과의 "도안 보관함 바로가기"가 이 주소로 보낸다. 이미 이 화면이라
			// 화면은 그대로인데 창만 덮여 있게 되므로 여기서 걷어낸다.
			setExtractOpen(false);
		}
	}, [tabParam]);

	const nickname = useUserStore((s) => s.nickname);
	const avatarUrl = useUserStore((s) => s.avatarUrl);
	const accessToken = useAuthStore((s) => s.accessToken);
	const authUser = useAuthStore((s) => s.user);
	const authUserId = authUser?.userId;
	// 세션 사용자는 GET /users/me가 돌아온 뒤에 채워진다. "로그인했는지"는 토큰으로,
	// "내가 누군지"가 필요한 곳만 authUserId로 판단한다.
	const isLoggedIn = Boolean(accessToken);
	const { requireAuth } = useRequireAuth();
	// sm(640px) 미만 — 상세 모달이 사진 칸을 접는 구간과 같은 경계
	const isMobile = useIsMobile(639);

	const {
		data: me,
		isPending: isMePending,
		isError: isMeError,
		error: meError,
	} = useMe();

	// GET /users/me에는 팔로워·팔로잉 수가 없다. 공개 프로필 조회로 따로 받아온다.
	const { data: publicMe } = useUserProfile(me?.userId ?? 0);

	useEffect(() => {
		setActivePost(null);
		setCardPostId(null);
		setActiveDesign(null);
	}, [authUserId]);

	const { data: myFeedData, isPending: isFeedPending, isFetching: isFeedFetching } = useMyPosts({
		size: 50,
	});
	const {
		data: bookmarkData,
		isPending: isBookmarkPending,
		isFetching: isBookmarkFetching,
	} = useBookmarkedPosts({ size: 50 });
	const {
		data: archiveData,
		isPending: isArchivePending,
		isError: isArchiveError,
		error: archiveError,
		isFetching: isArchiveFetching,
	} = useArchive({ size: 50 });
	const { mutate: removeFromArchive, isPending: isRemovingArchive } =
		useRemoveFromArchive();

	const myPosts = useMemo(
		() => {
			const items = myFeedData?.pages.flatMap((page) => page.items) ?? [];
			return QA_MOCK_DATA_ENABLED && items.length === 0 ? mockPosts.slice(0, 7) : items;
		},
		[myFeedData?.pages],
	);
	const bookmarkedPosts = useMemo(
		() => {
			const items = bookmarkData?.pages.flatMap((page) => page.items) ?? [];
			return QA_MOCK_DATA_ENABLED && items.length === 0 ? mockPosts.slice(3, 10) : items;
		},
		[bookmarkData?.pages],
	);
	const cardPost = useMemo(() => {
		if (cardPostId == null) return null;
		return (
			[...myPosts, ...bookmarkedPosts].find((post) => post.id === cardPostId) ??
			null
		);
	}, [cardPostId, myPosts, bookmarkedPosts]);

	/**
	 * 썸네일을 눌렀을 때.
	 *
	 * 모바일은 곧바로 댓글이 뜨면 사진을 볼 수 없어서 커뮤니티 카드와 같은 화면을
	 * 한 번 거친다. 넓은 화면은 상세 모달이 사진과 댓글을 나란히 보여주므로 그대로 연다.
	 */
	const handleOpenPost = (post: Post) => {
		if (isMobile) {
			setCardPostId(post.id);
			return;
		}
		setActivePost(post);
	};

	const savedDesigns = useMemo(() => {
		const fromApi =
			archiveData?.pages.flatMap((page) =>
				page.items.map(mapArchiveItemToSavedDesign),
			) ?? [];
		if (!isLoggedIn) return [];
		return QA_MOCK_DATA_ENABLED ? mergeWithDemoArchiveDesigns(fromApi) : fromApi;
	}, [archiveData?.pages, isLoggedIn]);

	/*
	 * 가득 찼는지는 데모용으로 섞는 도안을 뺀 서버 개수로만 따진다.
	 * 여기서 이미 첫 페이지(size 50)를 받아오므로 용량 훅을 따로 부르지 않는다.
	 */
	const archiveCount =
		archiveData?.pages.reduce((total, page) => total + page.items.length, 0) ?? 0;
	const isArchiveFull = isLoggedIn && archiveCount >= MAX_ARCHIVE_DESIGNS;

	const meErrorMessage =
		meError instanceof ApiError
			? meError.message
			: "프로필을 불러오지 못했습니다.";
	const archiveErrorMessage =
		archiveError instanceof ApiError
			? archiveError.message
			: "도안 보관함을 불러오지 못했습니다.";

	const handleRemoveDesign = (tattooId: number) => {
		if (!requireAuth() || isDemoArchiveDesign(tattooId)) return;
		removeFromArchive(tattooId, {
			onError: (err) => {
				window.alert(
					err instanceof ApiError
						? err.message
						: "도안 보관함에서 삭제하지 못했습니다.",
				);
			},
		});
	};

	const isFeedLoading = isFeedPending || (isFeedFetching && myPosts.length === 0);
	const isBookmarkLoading =
		isBookmarkPending || (isBookmarkFetching && bookmarkedPosts.length === 0);
	const isArchiveLoading =
		isArchivePending || (isArchiveFetching && savedDesigns.length === 0);

	const isArtist = me?.role === "ARTIST" || authUser?.role === "ARTIST";
	// artistProfile은 role=ARTIST이고 확장 행이 있을 때만 내려온다.
	const artist = me?.artist;
	// 숍 도시·주소·전화·영업 안내는 공개 목록(GET /artists)에서 나를 찾아 읽는다.
	// 인증(VERIFIED) 전이면 목록에 없어 null이고, 매장명·인증 상태만 보여준다.
	const { data: artistDetail, isPending: isArtistDetailPending } =
		useMyArtistProfile(me?.userId ?? 0, isArtist);
	/** 뱃지는 인증(VERIFIED)까지 끝난 타투이스트에게만 붙는다 */
	const showArtistBadge = isVerifiedArtist(
		me?.role ?? authUser?.role,
		artist?.verificationStatus,
	);
	/**
	 * 인증 뱃지 신청 버튼을 보여줄지.
	 *
	 * 타투이스트 계정만 신청 대상이다 (일반 사용자는 애초에 신청할 것이 없다).
	 * 이미 VERIFIED면 뱃지가 붙어 있어 신청할 이유가 없으므로 감춘다.
	 */
	const canRequestArtistBadge = isArtist && !showArtistBadge;

	return (
		<div className="min-h-[calc(100vh-var(--nav-h))] bg-surface px-0 pb-28 pt-5 lg:px-6 lg:pb-16 lg:pt-10">
			<div className="mx-auto w-full max-w-[900px]">
				{isLoggedIn && isMeError && (
					<p className="mb-4 text-center text-[14px] text-black/60">
						{meErrorMessage}
					</p>
				)}
				<div className="px-4 lg:px-0"><MyPageHeader
					nickname={me?.nickname ?? nickname}
					avatarUrl={me?.profileImageUrl ?? avatarUrl}
					postCount={isFeedLoading ? undefined : myPosts.length}
					followerCount={publicMe?.followerCount}
					followingCount={publicMe?.followingCount}
					isLoading={isLoggedIn && isMePending}
					isVerifiedArtist={showArtistBadge}
					onOpenFollowList={setFollowListKind}
					onRequestArtistBadge={
						canRequestArtistBadge
							? () => setBadgeRequestOpen(true)
							: undefined
					}
					onOpenBlockedList={
						isLoggedIn
							? () => requireAuth(() => setBlockedListOpen(true))
							: undefined
					}
				/></div>

				{isArtist && (
					<MyPageShopInfo
						artist={artist}
						detail={artistDetail ?? null}
						isLoading={isMePending || isArtistDetailPending}
					/>
				)}

				<div className="mt-8 lg:mt-8">
					<MyPageTabs active={tab} onChange={setTab} />
				</div>

				<div className="mt-4 lg:mt-8">
					{/*
					 * 도안 추출은 탭이 아니라 도안을 만들어 보관함에 채우는 동작이다.
					 * 탭 줄에 두면 탭처럼 보여서, 결과가 쌓이는 이 목록 위에 두었다.
					 */}
					{tab === "designs" && (
						<div className="mb-3 flex justify-end">
							<button
								type="button"
								aria-label="도안 추출"
								title="도안 추출"
								onClick={() =>
								requireAuth(() => {
									// 가득 찼으면 추출 창을 열기 전에 먼저 알린다
									if (isArchiveFull) {
										setShowArchiveFull(true);
										return;
									}
									setExtractOpen(true);
								})
							}
								className="flex size-11 items-center justify-center rounded-full text-brand transition hover:bg-brand/10">
								<PlusIcon />
							</button>
						</div>
					)}

					{tab === "feed" &&
						(!isLoggedIn ? (
							<MyPageEmptyState
								message="로그인 후 내 게시물을 확인할 수 있습니다"
								actionLabel="게시물 작성"
								onAction={() => requireAuth(() => setWriteOpen(true))}
							/>
						) : isFeedLoading ? (
							<StarttooLoader variant="block" />
						) : myPosts.length === 0 ? (
							<MyPageEmptyState
								message="게시물이 없습니다"
								actionLabel="게시물 작성"
								onAction={() => requireAuth(() => setWriteOpen(true))}
							/>
						) : (
							<PostThumbnailGrid posts={myPosts} onOpen={handleOpenPost} />
						))}

					{tab === "designs" &&
						(!isLoggedIn ? (
							<MyPageEmptyState message="로그인 후 도안 보관함을 확인할 수 있습니다" />
						) : isArchiveLoading ? (
							<StarttooLoader variant="block" />
						) : isArchiveError ? (
							<MyPageEmptyState message={archiveErrorMessage} />
						) : savedDesigns.length === 0 ? (
							<MyPageEmptyState message="저장한 도안이 없습니다" />
						) : (
							<DesignThumbnailGrid
								designs={savedDesigns}
								onOpen={setActiveDesign}
								onRemove={handleRemoveDesign}
								removeDisabled={isRemovingArchive}
							/>
						))}

					{tab === "bookmarks" &&
						(!isLoggedIn ? (
							<MyPageEmptyState message="로그인 후 북마크를 확인할 수 있습니다" />
						) : isBookmarkLoading ? (
							<StarttooLoader variant="block" />
						) : bookmarkedPosts.length === 0 ? (
							<MyPageEmptyState message="북마크한 게시물이 없습니다" />
						) : (
							<PostThumbnailGrid
								posts={bookmarkedPosts}
								onOpen={handleOpenPost}
							/>
						))}

					{tab === "collection" &&
						(!isLoggedIn ? (
							<MyPageEmptyState message="로그인 후 내 컬렉션을 확인할 수 있습니다" />
						) : !authUserId ? (
							<StarttooLoader variant="block" />
						) : (
							<CollectionEditor
								userId={authUserId}
								designs={savedDesigns}
								isArchiveLoading={isArchiveLoading}
							/>
						))}
				</div>
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
			<CreatePostModal
				isOpen={isWriteOpen}
				onClose={() => setWriteOpen(false)}
			/>
			{/* 도안은 배경이 비어 있어 도안 보관함 썸네일과 같은 흰 바탕에서 봐야 한다 */}
			<ImageViewerModal
				src={activeDesign?.previewUrl ?? ""}
				alt="저장한 도안"
				variant="light"
				isOpen={!!activeDesign}
				onClose={() => setActiveDesign(null)}
			/>
			<FollowListModal
				isOpen={followListKind !== null && !!me?.userId}
				userId={me?.userId ?? 0}
				kind={followListKind ?? "followers"}
				onChangeKind={setFollowListKind}
				onClose={() => setFollowListKind(null)}
			/>
			<ArtistBadgeRequestModal
				isOpen={isBadgeRequestOpen}
				onClose={() => setBadgeRequestOpen(false)}
			/>
			<BlockedListModal
				isOpen={isBlockedListOpen}
				onClose={() => setBlockedListOpen(false)}
			/>
			{/* 닫으면 언마운트되어 고른 사진과 추출 결과가 함께 정리된다 */}
			{isExtractOpen && (
				<DesignExtractModal onClose={() => setExtractOpen(false)} />
			)}
			<ArchiveFullModal
				isOpen={showArchiveFull}
				onClose={() => setShowArchiveFull(false)}
			/>
		</div>
	);
}
