import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import ConfirmModal from "../components/common/ConfirmModal";
import PostCard from "../components/community/PostCard";
import PostDetailModal from "../components/community/PostDetailModal";
import { PlusIcon } from "../components/community/icons";
import { MOCK_POSTS } from "../mocks/community";
import type { Post } from "../types/community";

/** 커뮤니티 피드 — 시연용 목업 데이터 (TODO: GET /posts 연동) */
export default function CommunityPage() {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [activePost, setActivePost] = useState<Post | null>(null);
	const [isWriteOpen, setWriteOpen] = useState(false);

	// TODO: 게시물 작성 플로우 연동 (현재는 이미지 선택까지만)
	const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
		e.target.value = "";
		setWriteOpen(false);
	};

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface pb-16 pt-8">
			<div className="mx-auto flex w-full max-w-[440px] flex-col gap-10 px-4">
				{MOCK_POSTS.map((post) => (
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

			<ConfirmModal
				title="게시물에 사용할 이미지를 선택해주세요"
				isOpen={isWriteOpen}
				onClose={() => setWriteOpen(false)}
				cancelText="컴퓨터에서 선택"
				confirmText="보관함에서 선택"
				onCancel={() => fileInputRef.current?.click()}
				// TODO: 보관함 연동되면 보관함 선택 모달로 교체
				onConfirm={() => setWriteOpen(false)}
			/>

			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={handleFileChange}
			/>
		</div>
	);
}
