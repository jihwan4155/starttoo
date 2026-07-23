import { useState } from "react";
import CreatePostModal from "../components/community/CreatePostModal";
import PostCard from "../components/community/PostCard";
import PostDetailModal from "../components/community/PostDetailModal";
import { PlusIcon } from "../components/community/icons";
import { MOCK_POSTS } from "../mocks/community";
import useCommunityStore from "../store/useCommunityStore";
import type { Post } from "../types/community";

/** 커뮤니티 피드 — 시연용 목업 데이터 (TODO: GET /posts 연동) */
export default function CommunityPage() {
	const [activePost, setActivePost] = useState<Post | null>(null);
	const [isWriteOpen, setWriteOpen] = useState(false);
	// 이 세션에서 올린 게시물을 피드 맨 위에 노출
	const myPosts = useCommunityStore((s) => s.myPosts);
	const feedPosts = [...myPosts, ...MOCK_POSTS];

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface pb-16 pt-8">
			<div className="mx-auto flex w-full max-w-[440px] flex-col gap-10 px-4">
				{feedPosts.map((post) => (
					<PostCard key={post.id} post={post} onOpen={setActivePost} />
				))}
			</div>

			{/* 게시물 작성 */}
			<button
				type="button"
				aria-label="게시물 작성"
				onClick={() => setWriteOpen(true)}
				className="fixed bottom-8 right-8 z-40 flex size-14 items-center justify-center rounded-full bg-brand text-white shadow-[0_6px_20px_rgba(255,70,70,0.4)] transition hover:brightness-95 active:scale-95">
				<PlusIcon />
			</button>

			{/* key: 게시글이 바뀔 때 좋아요·입력 상태가 남지 않도록 리마운트 */}
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
