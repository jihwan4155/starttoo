import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PostDetailModal from "../components/community/PostDetailModal";
import usePosts from "../hooks/queries/usePosts";
import useHiddenIdsForUser from "../hooks/useHiddenIdsForUser";
import { ApiError } from "../services/api";
import type { Post } from "../types/community";
import { filterPostsByKeyword, filterVisiblePosts } from "../utils/filterPosts";

/** 커뮤니티 탐색·검색 — GET /posts + 클라이언트 필터 (POST /posts/search 501 대체) */
export default function CommunitySearchPage() {
	const [searchParams] = useSearchParams();
	const keyword = searchParams.get("q") ?? "";
	const [activePost, setActivePost] = useState<Post | null>(null);

	const { data, isPending, isError, error } = usePosts({ size: 50 });
	const hiddenIds = useHiddenIdsForUser();

	const allPosts = useMemo(() => {
		const items = data?.pages.flatMap((page) => page.items) ?? [];
		return filterVisiblePosts(items, hiddenIds);
	}, [data?.pages, hiddenIds]);
	const results = useMemo(
		() => filterPostsByKeyword(allPosts, keyword),
		[allPosts, keyword],
	);

	const errorMessage =
		error instanceof ApiError
			? error.message
			: "게시글을 불러오지 못했습니다.";

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface pb-16 pt-6">
			<div className="mx-auto w-full max-w-[1000px] px-6">
				{keyword && (
					<p className="mb-4 text-[14px] font-light text-black/60">
						<span className="font-semibold text-black">
							&ldquo;{keyword}&rdquo;
						</span>{" "}
						검색 결과 {results.length}건
					</p>
				)}

				{isPending && (
					<p className="py-20 text-center text-[14px] text-black/40">
						불러오는 중…
					</p>
				)}

				{isError && (
					<p className="py-20 text-center text-[14px] text-black/60">
						{errorMessage}
					</p>
				)}

				{!isPending && !isError && results.length === 0 && (
					<p className="py-20 text-center text-[14px] text-black/40">
						{keyword
							? "검색 결과가 없습니다."
							: "키워드를 입력해 검색해 보세요."}
					</p>
				)}

				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
					{results.map((post) => (
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

			<PostDetailModal
				key={activePost?.id}
				post={activePost}
				onClose={() => setActivePost(null)}
			/>
		</div>
	);
}
