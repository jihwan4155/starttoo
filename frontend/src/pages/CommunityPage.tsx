import { useEffect, useMemo, useRef, useState } from "react";
import CreatePostModal from "../components/community/CreatePostModal";
import StarttooLoader from "../components/loader/StarttooLoader";
import PostCard from "../components/community/PostCard";
import PostDetailModal from "../components/community/PostDetailModal";
import { PlusIcon } from "../components/community/icons";
import useFollowingPosts from "../hooks/queries/useFollowingPosts";
import usePosts from "../hooks/queries/usePosts";
import useRequireAuth from "../hooks/useRequireAuth";
import useAuthStore from "../store/useAuthStore";
import useCommunityStore from "../store/useCommunityStore";
import useHiddenIdsForUser from "../hooks/useHiddenIdsForUser";
import { ApiError } from "../services/api";
import type { CommunityFeedTab } from "../constants/community";
import type { Post } from "../types/community";
import { filterFeedPosts } from "../utils/filterPosts";

/** 커뮤니티 피드 — 전체(GET /posts) · 팔로잉(GET /posts/following) */
export default function CommunityPage() {
	const [activePost, setActivePost] = useState<Post | null>(null);
	const [isWriteOpen, setWriteOpen] = useState(false);
	const [feedTab, setFeedTab] = useState<CommunityFeedTab>("all");
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const { requireAuth } = useRequireAuth();
	const accessToken = useAuthStore((s) => s.accessToken);
	const hiddenIds = useHiddenIdsForUser();
	const overlayHiddenIds = useCommunityStore((s) => s.overlayHiddenIds);
	const clearAllOverlays = useCommunityStore((s) => s.clearAllOverlays);

	const allQuery = usePosts({ size: 20 });
	const followingQuery = useFollowingPosts({ size: 20 });

	const activeQuery = feedTab === "following" ? followingQuery : allQuery;
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
	} = activeQuery;

	const feedPosts = useMemo(() => {
		const items = data?.pages.flatMap((page) => page.items) ?? [];
		return filterFeedPosts(items, hiddenIds, overlayHiddenIds);
	}, [data?.pages, hiddenIds, overlayHiddenIds]);

	useEffect(() => {
		clearAllOverlays();
	}, [clearAllOverlays]);

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

	const handleTabChange = (tab: CommunityFeedTab) => {
		if (tab === "following" && !accessToken) {
			requireAuth();
			return;
		}
		setFeedTab(tab);
	};

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface pb-16 pt-8">
			<div className="mx-auto flex w-full max-w-[440px] -translate-x-10 flex-col gap-10 px-4">
				<div className="flex justify-center gap-2">
					{(["all", "following"] as const).map((tab) => (
						<button
							key={tab}
							type="button"
							onClick={() => handleTabChange(tab)}
							className={`rounded-full px-5 py-2 text-[13px] font-semibold transition ${
								feedTab === tab
									? "bg-black text-white"
									: "bg-white text-black/60 hover:bg-black/5"
							}`}>
							{tab === "all" ? "전체" : "팔로잉"}
						</button>
					))}
				</div>

				{isPending && (
					<StarttooLoader variant="block" label="피드를 불러오는 중…" />
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
						{feedTab === "following"
							? "팔로우한 사용자의 게시물이 없습니다."
							: "아직 게시물이 없습니다."}
					</p>
				)}

				{!isPending &&
					feedPosts.map((post) => (
						<PostCard key={post.id} post={post} onOpen={setActivePost} />
					))}

				{!isPending && !isError && feedPosts.length > 0 && (
					<div ref={loadMoreRef} className="py-6 text-center">
						{isFetchingNextPage && (
							<div className="flex items-center justify-center gap-2 text-[13px] text-black/40">
								<StarttooLoader variant="mark" label={null} /> 더 불러오는 중…
							</div>
						)}
						{!hasNextPage && !isFetchingNextPage && (
							<p className="text-[13px] text-black/30">마지막 게시물입니다</p>
						)}
					</div>
				)}
			</div>

			<button
				type="button"
				aria-label="게시물 작성"
				onClick={() => requireAuth(() => setWriteOpen(true))}
				className="fixed bottom-8 right-8 z-40 flex size-14 items-center justify-center rounded-full bg-brand text-white shadow-[0_6px_20px_rgba(255,70,70,0.4)] transition hover:brightness-95 active:scale-95">
				<PlusIcon />
			</button>

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
