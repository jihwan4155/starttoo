import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import PostDetailModal from "../components/community/PostDetailModal";
import StarttooLoader from "../components/loader/StarttooLoader";
import { PostGridSkeleton } from "../components/loader/Skeletons";
import { POST_LOGIN_REDIRECT_STORAGE_KEY } from "../constants/auth";
import usePostSearch from "../hooks/queries/usePostSearch";
import usePosts from "../hooks/queries/usePosts";
import useHiddenIdsForUser from "../hooks/useHiddenIdsForUser";
import { ApiError } from "../services/api";
import useAuthStore from "../store/useAuthStore";
import type { Post } from "../types/community";
import { isSearchableQuery } from "../types/search";
import { filterVisiblePosts } from "../utils/filterPosts";
import CommunitySearchBar from "../components/community/CommunitySearchBar";

/**
 * 피드 검색 — GET /search/posts (subject 기반)
 *
 * 검색어가 없을 때는 인스타그램 탐색 탭처럼 그리드를 보여준다. 이 그리드가 곧
 * 추천 피드다 — GET /posts는 로그인한 조회자에게 스타일·색상 취향 점수와 최신성을
 * 섞은 점수 내림차순으로 주기 때문이다(작성자 필터가 없을 때만. 내 글은 빠진다).
 * 별도의 추천 엔드포인트는 없으므로 authorSeq를 붙이면 안 된다 — 붙이는 순간
 * 서버가 최신순 목록으로 갈아탄다.
 *
 * 취향 점수가 없는 계정(찜·체류 이력이 없는 새 계정)은 블렌드가 최신성만 남아
 * 전체 최신순과 같아 보인다. 화면 문제가 아니라 쌓인 데이터가 없는 것이다.
 */
export default function CommunitySearchPage() {
	const [searchParams] = useSearchParams();
	const keyword = searchParams.get("q") ?? "";
	const [activePost, setActivePost] = useState<Post | null>(null);
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const navigate = useNavigate();
	const location = useLocation();
	const isLoggedIn = useAuthStore((s) => Boolean(s.accessToken));

	// 피드 목록은 공개지만 피드 상세는 로그인이 필요하다.
	// 로그인 후 이 검색 결과(검색어 포함)로 돌아오도록 목적지를 남긴다.
	const handleOpenPost = (post: Post) => {
		if (!isLoggedIn) {
			sessionStorage.setItem(
				POST_LOGIN_REDIRECT_STORAGE_KEY,
				location.pathname + location.search,
			);
			navigate("/login");
			return;
		}
		setActivePost(post);
	};

	const hiddenIds = useHiddenIdsForUser();

	const trimmed = keyword.trim();
	/** 서버에 보낼 수 없는 검색어 — 쿼리가 꺼져 있어 로딩·결과 상태를 믿을 수 없다 */
	const isUnsearchable = trimmed.length > 0 && !isSearchableQuery(trimmed);
	/** 검색어가 없을 때만 탐색 그리드를 띄운다 */
	const isExplore = trimmed.length === 0;

	const searchQuery = usePostSearch(keyword);
	const exploreQuery = usePosts({ size: 24, enabled: isExplore });

	// 두 목록은 화면을 번갈아 차지한다. 페이지 타입이 서로 달라(검색만 matchedSubject를
	// 갖는다) 구조 분해로 합치면 유니온이 되므로, 쓰는 값만 하나씩 골라 온다.
	const searchPages = searchQuery.data?.pages;
	const explorePages = exploreQuery.data?.pages;
	const active = isExplore ? exploreQuery : searchQuery;
	const isPending = active.isPending;
	const isFetching = active.isFetching;
	const isError = active.isError;
	const error = active.error;
	const refetch = active.refetch;
	const fetchNextPage = active.fetchNextPage;
	const hasNextPage = active.hasNextPage;
	const isFetchingNextPage = active.isFetchingNextPage;

	const results = useMemo(() => {
		const pages = isExplore ? explorePages : searchPages;
		const items = pages?.flatMap((page) => page.items) ?? [];
		return filterVisiblePosts(items, hiddenIds);
	}, [isExplore, explorePages, searchPages, hiddenIds]);

	/**
	 * 오타가 보정된 실제 subject — 페이지마다 같아 첫 페이지 것을 쓴다.
	 * 입력과 다르면 "OO(으)로 찾았어요"를 보여줘 결과가 왜 이건지 알려 준다.
	 */
	const matchedSubject = searchPages?.[0]?.matchedSubject ?? null;
	const isCorrected =
		matchedSubject != null &&
		matchedSubject.subjectName.toLowerCase() !== trimmed.toLowerCase();

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
			: isExplore
				? "피드를 불러오지 못했습니다."
				: "검색 결과를 불러오지 못했습니다.";

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface pb-28 pt-5 lg:pb-16 lg:pt-6">
			<div className="mx-auto w-full max-w-[1000px] px-4 lg:px-6">
				<div className="mb-5 hidden max-lg:block [&_form]:h-12 [&_form]:shadow-none"><CommunitySearchBar /></div>

				{isExplore && (
					<p className="mb-4 text-[14px] font-light text-black/60">
						<span className="font-semibold text-black">추천 피드</span> · 키워드를
						입력하면 검색할 수 있어요
					</p>
				)}

				{trimmed && !isUnsearchable && !isPending && (
					<p className="mb-4 text-[14px] font-light text-black/60">
						<span className="font-semibold text-black">
							&ldquo;{trimmed}&rdquo;
						</span>{" "}
						검색 결과 {results.length}건
						{hasNextPage && "+"}
						{isCorrected && (
							<span className="ml-1 text-black/45">
								· &lsquo;{matchedSubject?.subjectName}&rsquo;(으)로 찾았어요
							</span>
						)}
					</p>
				)}

				{isUnsearchable && (
					<p className="py-20 text-center text-[14px] font-light leading-6 text-black/50">
						검색어에는 한글·영문·숫자만 쓸 수 있어요.
						<br />
						공백이나 특수문자를 빼고 다시 검색해 주세요.
					</p>
				)}

				{isExplore && isPending && <PostGridSkeleton />}

				{isExplore && !isPending && !isError && results.length === 0 && (
					<p className="py-20 text-center text-[14px] text-black/40">
						아직 올라온 피드가 없어요.
					</p>
				)}

				{trimmed && !isUnsearchable && isPending && (
					<PostGridSkeleton count={6} />
				)}

				{(isExplore || (trimmed && !isUnsearchable)) && isError && (
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

				{trimmed &&
					!isUnsearchable &&
					!isPending &&
					!isError &&
					results.length === 0 && (
						<p className="py-20 text-center text-[14px] text-black/40">
							검색 결과가 없습니다.
						</p>
					)}

				<div className="grid grid-cols-3 gap-0.5 lg:grid-cols-4 lg:gap-3">
					{results.map((post) => (
						<button
							key={post.id}
							type="button"
							aria-label={`${post.author.nickname}의 피드 보기`}
							onClick={() => handleOpenPost(post)}
							className="aspect-[3/4] overflow-hidden bg-[#D9D9D9] lg:rounded-[6px]">
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

				{results.length > 0 && (
					<div ref={loadMoreRef} className="py-6 text-center">
						{isFetchingNextPage && (
							<div className="flex items-center justify-center gap-2 text-[13px] text-black/40">
								<StarttooLoader variant="mark" label={null} /> 더 불러오는 중…
							</div>
						)}
						{!hasNextPage && !isFetchingNextPage && (
							<p className="text-[13px] text-black/30">마지막 결과입니다</p>
						)}
					</div>
				)}
			</div>

			<PostDetailModal
				key={activePost?.id}
				post={activePost}
				onClose={() => setActivePost(null)}
			/>
		</div>
	);
}
