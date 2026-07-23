import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ImageViewerModal from "../components/common/ImageViewerModal";
import CreatePostModal from "../components/community/CreatePostModal";
import PostDetailModal from "../components/community/PostDetailModal";
import DesignThumbnailGrid from "../components/mypage/DesignThumbnailGrid";
import MyPageEmptyState from "../components/mypage/MyPageEmptyState";
import MyPageHeader from "../components/mypage/MyPageHeader";
import MyPageTabs, { type MyPageTab } from "../components/mypage/MyPageTabs";
import PostThumbnailGrid from "../components/mypage/PostThumbnailGrid";
import { MOCK_POSTS } from "../mocks/community";
import useCommunityStore from "../store/useCommunityStore";
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

/** 마이페이지 — 내 피드/북마크는 실제 커뮤니티 스토어 상태를 그대로 사용 */
export default function MyPage() {
	// ?tab=designs 등 쿼리로 특정 탭을 바로 열 수 있다 (도안함 바로가기 등)
	const [searchParams] = useSearchParams();
	const tabParam = searchParams.get("tab");
	const [tab, setTab] = useState<MyPageTab>(
		isMyPageTab(tabParam) ? tabParam : "feed",
	);
	const [isWriteOpen, setWriteOpen] = useState(false);
	const [activePost, setActivePost] = useState<Post | null>(null);
	const [activeDesign, setActiveDesign] = useState<SavedDesign | null>(null);

	// 마이페이지에 이미 있을 때 쿼리만 바뀌어도 탭 전환 + 열린 모달 정리
	useEffect(() => {
		if (isMyPageTab(tabParam)) {
			setTab(tabParam);
			setActivePost(null);
		}
	}, [tabParam]);

	const nickname = useUserStore((s) => s.nickname);
	const avatarUrl = useUserStore((s) => s.avatarUrl);
	const myPosts = useCommunityStore((s) => s.myPosts);
	const bookmarked = useCommunityStore((s) => s.bookmarked);
	const savedDesigns = useDesignStore((s) => s.savedDesigns);
	const removeDesign = useDesignStore((s) => s.removeDesign);
	const bookmarkedPosts = [...myPosts, ...MOCK_POSTS].filter(
		(post) => bookmarked[post.id],
	);

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface px-6 pb-16 pt-10">
			<div className="mx-auto w-full max-w-[900px]">
				<MyPageHeader nickname={nickname} avatarUrl={avatarUrl} />

				<div className="mt-8">
					<MyPageTabs active={tab} onChange={setTab} />
				</div>

				<div className="mt-8">
					{tab === "feed" &&
						(myPosts.length === 0 ? (
							<MyPageEmptyState
								message="게시글이 없습니다"
								actionLabel="게시글 작성"
								onAction={() => setWriteOpen(true)}
							/>
						) : (
							<PostThumbnailGrid posts={myPosts} onOpen={setActivePost} />
						))}

					{/* 게시글 상세 → 도안 추출 → 내 도안에 추가 로 저장된 도안 목록 */}
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
						(bookmarkedPosts.length === 0 ? (
							<MyPageEmptyState message="북마크한 게시글이 없습니다" />
						) : (
							<PostThumbnailGrid
								posts={bookmarkedPosts}
								onOpen={setActivePost}
							/>
						))}

					{/* TODO: 내 컬렉션 기능 구현 예정 */}
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
