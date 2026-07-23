import { useState } from "react";
import CreatePostModal from "../components/community/CreatePostModal";
import PostDetailModal from "../components/community/PostDetailModal";
import MyPageEmptyState from "../components/mypage/MyPageEmptyState";
import MyPageHeader from "../components/mypage/MyPageHeader";
import MyPageTabs, { type MyPageTab } from "../components/mypage/MyPageTabs";
import PostThumbnailGrid from "../components/mypage/PostThumbnailGrid";
import { MOCK_POSTS } from "../mocks/community";
import useCommunityStore from "../store/useCommunityStore";
import useUserStore from "../store/useUserStore";
import type { Post } from "../types/community";

/** 마이페이지 — 내 피드/북마크는 실제 커뮤니티 스토어 상태를 그대로 사용 */
export default function MyPage() {
	const [tab, setTab] = useState<MyPageTab>("feed");
	const [isWriteOpen, setWriteOpen] = useState(false);
	const [activePost, setActivePost] = useState<Post | null>(null);

	const nickname = useUserStore((s) => s.nickname);
	const avatarUrl = useUserStore((s) => s.avatarUrl);
	const myPosts = useCommunityStore((s) => s.myPosts);
	const bookmarked = useCommunityStore((s) => s.bookmarked);
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

					{/* TODO: 도안 저장 기능(POST /designs) 연동 전까지는 항상 빈 상태 */}
					{tab === "designs" && (
						<MyPageEmptyState message="저장한 도안이 없습니다" />
					)}

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
		</div>
	);
}
