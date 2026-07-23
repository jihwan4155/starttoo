import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import PostDetailModal from "../components/community/PostDetailModal";
import { MOCK_EXPLORE_POSTS } from "../mocks/community";
import type { Post } from "../types/community";

/** 커뮤니티 탐색·검색 결과 그리드 — 시연용 목업 (TODO: GET /posts/search 연동) */
export default function CommunitySearchPage() {
	const [searchParams] = useSearchParams();
	const keyword = searchParams.get("q") ?? "";
	const [activePost, setActivePost] = useState<Post | null>(null);

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface pb-16 pt-6">
			<div className="mx-auto w-full max-w-[1000px] px-6">
				{keyword && (
					<p className="mb-4 text-[14px] font-light text-black/60">
						<span className="font-semibold text-black">
							&ldquo;{keyword}&rdquo;
						</span>{" "}
						검색 결과
					</p>
				)}

				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
					{MOCK_EXPLORE_POSTS.map((post) => (
						<button
							key={post.id}
							type="button"
							aria-label={`${post.author.nickname}의 게시글 보기`}
							onClick={() => setActivePost(post)}
							className="aspect-square overflow-hidden rounded-[6px] bg-[#D9D9D9]">
							{post.imageUrl && (
								<img
									src={post.imageUrl}
									alt=""
									className="h-full w-full object-cover transition hover:scale-[1.03]"
								/>
							)}
						</button>
					))}
				</div>
			</div>

			{/* key: 게시글이 바뀔 때 좋아요·입력 상태가 남지 않도록 리마운트 */}
			<PostDetailModal
				key={activePost?.id}
				post={activePost}
				onClose={() => setActivePost(null)}
			/>
		</div>
	);
}
