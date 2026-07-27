import { useEffect, useMemo, useRef, useState } from "react";
import CreatePostModal from "../components/community/CreatePostModal";
import PostCard from "../components/community/PostCard";
import PostDetailModal from "../components/community/PostDetailModal";
import { PlusIcon } from "../components/community/icons";
import usePosts from "../hooks/queries/usePosts";
import useCommunityStore from "../store/useCommunityStore";
import { ApiError } from "../services/api";
import type { Post } from "../types/community";

/** 커뮤니티 피드 — GET /posts (커서 무한 스크롤) */
export default function CommunityPage() {
	const [activePost, setActivePost] = useState<Post | null>(null);
	const [isWriteOpen, setWriteOpen] = useState(false);
	const loadMoreRef = useRef<HTMLDivElement>(null);

	const {
		data,
		isPending,
		isError,
		error,
		refetch,
		isFetching,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = usePosts({
		size: 20,
		sort: "LATEST",
	});

	const myPosts = useCommunityStore((s) => s.myPosts);
	const deletedIds = useCommunityStore((s) => s.deletedIds);

	const feedPosts = useMemo(() => {
		// LATEST 피드는 서버 순서(postId desc 커서)를 유지한다.
		// createdAt으로 재정렬하면 다음 페이지 로드 시 목록이 위로 점프한다.
		const apiPosts = data?.pages.flatMap((page) => page.items) ?? [];
		const seen = new Set<number>();
		const merged: Post[] = [];
		for (const post of [...myPosts, ...apiPosts]) {
			if (deletedIds[post.id] || seen.has(post.id)) continue;
			seen.add(post.id);
			merged.push(post);
		}
		return merged;
	}, [data?.pages, myPosts, deletedIds]);

	// 하단 sentinel이 보이면 다음 페이지 요청
	useEffect(() => {
		const node = loadMoreRef.current;
		if (!node) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				if (
					entry?.isIntersecting &&
					hasNextPage &&
					!isFetchingNextPage &&
					!isError
				) {
					void fetchNextPage();
				}
			},
			{ root: null, rootMargin: "240px", threshold: 0 },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage, isError]);

	const errorMessage =
		error instanceof ApiError
			? error.message
			: "피드를 불러오지 못했습니다.";

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface pb-16 pt-8">
			{/* ml-20(사이드 네비) 보정: 화면 전체 기준으로 중앙에 오도록 살짝 왼쪽 이동 */}
			<div className="mx-auto flex w-full max-w-[440px] -translate-x-10 flex-col gap-10 px-4">
				{isPending && (
					<p className="py-20 text-center text-[14px] text-black/40">
						피드를 불러오는 중…
					</p>
				)}

				{isError && feedPosts.length === 0 && (
					<div className="flex flex-col items-center gap-4 py-20">
						<p className="text-center text-[14px] text-black/60">
							{errorMessage}
						</p>
						<button
							type="button"
							onClick={() => void refetch()}
							disabled={isFetching}
							className="rounded-full border border-black/20 px-5 py-2 text-[13px] font-semibold transition hover:bg-black/5 disabled:opacity-50">
							다시 시도
						</button>
					</div>
				)}

				{!isPending && !isError && feedPosts.length === 0 && (
					<p className="py-20 text-center text-[14px] text-black/40">
						아직 게시물이 없습니다.
					</p>
				)}

				{!isPending &&
					feedPosts.map((post) => (
						<PostCard key={post.id} post={post} onOpen={setActivePost} />
					))}

				{/* 무한 스크롤 트리거 */}
				{!isPending && !isError && feedPosts.length > 0 && (
					<div ref={loadMoreRef} className="py-6 text-center">
						{isFetchingNextPage && (
							<p className="text-[13px] text-black/40">더 불러오는 중…</p>
						)}
						{!hasNextPage && !isFetchingNextPage && (
							<p className="text-[13px] text-black/30">마지막 게시물입니다</p>
						)}
					</div>
				)}
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
