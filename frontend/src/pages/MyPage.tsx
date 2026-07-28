import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ImageViewerModal from "../components/common/ImageViewerModal";
import CreatePostModal from "../components/community/CreatePostModal";
import PostDetailModal from "../components/community/PostDetailModal";
import DesignThumbnailGrid from "../components/mypage/DesignThumbnailGrid";
import MyPageEmptyState from "../components/mypage/MyPageEmptyState";
import MyPageHeader from "../components/mypage/MyPageHeader";
import MyPageTabs, { type MyPageTab } from "../components/mypage/MyPageTabs";
import PostThumbnailGrid from "../components/mypage/PostThumbnailGrid";
import useBookmarkedPosts from "../hooks/queries/useBookmarkedPosts";
import useMyPosts from "../hooks/queries/useMyPosts";
import useRequireAuth from "../hooks/useRequireAuth";
import useAuthStore from "../store/useAuthStore";
import useDesignStore from "../store/useDesignStore";
import useUserStore from "../store/useUserStore";
import type { Post } from "../types/community";
import type { SavedDesign } from "../types/designExtract";

function isMyPageTab(value: string | null): value is MyPageTab {
	return (
		value === "feed" ||
		value === "designs" ||
		value === "bookmarks" ||
		value === "collection"
	);
}

/** 마이페이지 — GET /users/me/posts, GET /users/me/bookmarked-posts */
export default function MyPage() {
	const [searchParams] = useSearchParams();
	const tabParam = searchParams.get("tab");
	const [tab, setTab] = useState<MyPageTab>(
		isMyPageTab(tabParam) ? tabParam : "feed",
	);
	const [isWriteOpen, setWriteOpen] = useState(false);
	const [activePost, setActivePost] = useState<Post | null>(null);
	const [activeDesign, setActiveDesign] = useState<SavedDesign | null>(null);

	useEffect(() => {
		if (isMyPageTab(tabParam)) {
			setTab(tabParam);
			setActivePost(null);
		}
	}, [tabParam]);

	const nickname = useUserStore((s) => s.nickname);
	const avatarUrl = useUserStore((s) => s.avatarUrl);
	const authUser = useAuthStore((s) => s.user);
	const { requireAuth } = useRequireAuth();

	const { data: myFeedData, isPending: isFeedPending } = useMyPosts({
		size: 50,
	});
	const { data: bookmarkData, isPending: isBookmarkPending } =
		useBookmarkedPosts({ size: 50 });

	const myPosts = useMemo(
		() => myFeedData?.pages.flatMap((page) => page.items) ?? [],
		[myFeedData?.pages],
	);
	const bookmarkedPosts = useMemo(
		() => bookmarkData?.pages.flatMap((page) => page.items) ?? [],
		[bookmarkData?.pages],
	);

	const savedDesigns = useDesignStore((s) => s.savedDesigns);
	const removeDesign = useDesignStore((s) => s.removeDesign);

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface px-6 pb-16 pt-10">
			<div className="mx-auto w-full max-w-[900px]">
				<MyPageHeader nickname={nickname} avatarUrl={avatarUrl} />

				<div className="mt-8">
					<MyPageTabs active={tab} onChange={setTab} />
				</div>

				<div className="mt-8">
					{tab === "feed" &&
						(!authUser ? (
							<MyPageEmptyState
								message="로그인 후 내 게시글을 확인할 수 있습니다"
								actionLabel="게시글 작성"
								onAction={() => requireAuth(() => setWriteOpen(true))}
							/>
						) : isFeedPending ? (
							<p className="py-16 text-center text-[14px] text-black/40">
								불러오는 중…
							</p>
						) : myPosts.length === 0 ? (
							<MyPageEmptyState
								message="게시글이 없습니다"
								actionLabel="게시글 작성"
								onAction={() => requireAuth(() => setWriteOpen(true))}
							/>
						) : (
							<PostThumbnailGrid posts={myPosts} onOpen={setActivePost} />
						))}

					{tab === "designs" &&
						(savedDesigns.length === 0 ? (
							<MyPageEmptyState message="저장한 도안이 없습니다" />
						) : (
							<DesignThumbnailGrid
								designs={savedDesigns}
								onOpen={setActiveDesign}
								onRemove={removeDesign}
							/>
						))}

					{tab === "bookmarks" &&
						(!authUser ? (
							<MyPageEmptyState message="로그인 후 북마크를 확인할 수 있습니다" />
						) : isBookmarkPending ? (
							<p className="py-16 text-center text-[14px] text-black/40">
								불러오는 중…
							</p>
						) : bookmarkedPosts.length === 0 ? (
							<MyPageEmptyState message="북마크한 게시글이 없습니다" />
						) : (
							<PostThumbnailGrid
								posts={bookmarkedPosts}
								onOpen={setActivePost}
							/>
						))}

					{tab === "collection" && (
						<MyPageEmptyState message="준비 중이에요" />
					)}
				</div>
			</div>

			<PostDetailModal
				key={activePost?.id}
				post={activePost}
				onClose={() => setActivePost(null)}
			/>
			<CreatePostModal
				isOpen={isWriteOpen}
				onClose={() => setWriteOpen(false)}
			/>
			<ImageViewerModal
				src={activeDesign?.previewUrl ?? ""}
				alt="저장한 도안"
				isOpen={!!activeDesign}
				onClose={() => setActiveDesign(null)}
			/>
		</div>
	);
}
