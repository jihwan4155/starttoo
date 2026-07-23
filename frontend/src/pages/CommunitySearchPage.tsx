import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import PostDetailModal from "../components/community/PostDetailModal";
import { MOCK_EXPLORE_IMAGES, MOCK_POSTS } from "../mocks/community";
import type { Post } from "../types/community";

/** 커뮤니티 탐색·검색 결과 그리드 — 시연용 목업 (TODO: GET /posts/search 연동) */
export default function CommunitySearchPage() {
	const [searchParams] = useSearchParams();
	const keyword = searchParams.get("q") ?? "";
	const [activePost, setActivePost] = useState<Post | null>(null);

	const handleOpen = (imageUrl: string | null) => {
		// 목업: 이미지가 있는 셀은 해당 이미지를 쓰는 게시글 상세로 연결
		const post = MOCK_POSTS.find((p) => p.imageUrl === imageUrl);
		if (post) setActivePost(post);
	};

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
					{MOCK_EXPLORE_IMAGES.map((imageUrl, index) => (
						<button
							// 정적 목업 배열이라 index 키 안전
							key={index}
							type="button"
							aria-label={`게시글 ${index + 1} 보기`}
							onClick={() => handleOpen(imageUrl)}
							className="aspect-square overflow-hidden rounded-[6px] bg-[#D9D9D9]">
							{imageUrl && (
								<img
									src={imageUrl}
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
