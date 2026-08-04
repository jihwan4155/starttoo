import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CreatePostModal from "../components/community/CreatePostModal";
import StarttooLoader from "../components/loader/StarttooLoader";
import PostCard from "../components/community/PostCard";
import PostDetailModal from "../components/community/PostDetailModal";
import { PlusIcon } from "../components/community/icons";
import useFollowingPosts from "../hooks/queries/useFollowingPosts";
import useMyPosts from "../hooks/queries/useMyPosts";
import useRequireAuth from "../hooks/useRequireAuth";
import useCommunityStore from "../store/useCommunityStore";
import useHiddenIdsForUser from "../hooks/useHiddenIdsForUser";
import { ApiError } from "../services/api";
import type { Post } from "../types/community";
import { filterFeedPosts } from "../utils/filterPosts";
import { mockPosts } from "../mocks/community";
import { QA_MOCK_DATA_ENABLED } from "../config/qa";

/**
 * 커뮤니티 — 팔로우한 사용자의 게시물 + 내 게시물
 * (GET /posts/following + GET /posts/me). 팔로잉 피드에는 내 글이 들어오지 않아
 * 두 목록을 합쳐 최신순으로 보여준다.
 */
export default function CommunityPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const [activePost, setActivePost] = useState<Post | null>(null);
	const [isWriteOpen, setWriteOpen] = useState(false);
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const { requireAuth } = useRequireAuth();
	const hiddenIds = useHiddenIdsForUser();
	const overlayHiddenIds = useCommunityStore((s) => s.overlayHiddenIds);
	const clearAllOverlays = useCommunityStore((s) => s.clearAllOverlays);

	const followingQuery = useFollowingPosts({ size: 20 });
	const myQuery = useMyPosts({ size: 20 });

	// enabled가 false인 쿼리는 isPending이 계속 true라 isLoading(실제 로딩)으로 판단한다
	const isPending = followingQuery.isLoading || myQuery.isLoading;
	const isFetching = followingQuery.isFetching || myQuery.isFetching;
	const isError = followingQuery.isError || myQuery.isError;
	const error = followingQuery.error ?? myQuery.error;
	const hasNextPage = followingQuery.hasNextPage || myQuery.hasNextPage;
	const isFetchingNextPage =
		followingQuery.isFetchingNextPage || myQuery.isFetchingNextPage;

	const refetch = useCallback(() => {
		void followingQuery.refetch();
		void myQuery.refetch();
	}, [followingQuery, myQuery]);

	const fetchNextPage = useCallback(() => {
		if (followingQuery.hasNextPage && !followingQuery.isFetchingNextPage) {
			void followingQuery.fetchNextPage();
		}
		if (myQuery.hasNextPage && !myQuery.isFetchingNextPage) {
			void myQuery.fetchNextPage();
		}
	}, [followingQuery, myQuery]);

	const feedPosts = useMemo(() => {
		const items = [
			...(followingQuery.data?.pages.flatMap((page) => page.items) ?? []),
			...(myQuery.data?.pages.flatMap((page) => page.items) ?? []),
		];
		// 두 목록이 겹칠 수 있어 id로 중복을 걸러내고, 백엔드와 같은 최신순으로 정렬한다
		const unique = [...new Map(items.map((post) => [post.id, post])).values()];
		unique.sort((a, b) => b.id - a.id);
		const source =
			QA_MOCK_DATA_ENABLED && unique.length === 0 ? mockPosts : unique;
		return filterFeedPosts(source, hiddenIds, overlayHiddenIds);
	}, [followingQuery.data?.pages, myQuery.data?.pages, hiddenIds, overlayHiddenIds]);

	useEffect(() => {
		clearAllOverlays();
	}, [clearAllOverlays]);

	useEffect(() => {
		if (searchParams.get("compose") !== "1") return;
		requireAuth(() => setWriteOpen(true));
		setSearchParams({}, { replace: true });
	}, [requireAuth, searchParams, setSearchParams]);

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
		<div className="min-h-[calc(100vh-60px)] bg-surface pb-28 pt-5 lg:pb-16 lg:pt-8">
			<div className="mx-auto flex w-full max-w-[440px] flex-col gap-6 px-4 lg:-translate-x-10 lg:gap-10">
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
					<p className="py-20 text-center text-[14px] leading-6 text-black/40">
						보여줄 게시물이 없습니다.
						<br />
						관심 있는 작가를 팔로우하거나 첫 게시물을 올려보세요.
					</p>
				)}

				{feedPosts.map((post) => (
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
				className="fixed bottom-8 right-8 z-40 flex size-14 items-center justify-center rounded-full bg-brand text-white shadow-[0_6px_20px_rgba(255,70,70,0.4)] transition hover:brightness-95 active:scale-95 max-lg:hidden">
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
