import { useEffect, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ArtistBadge from "../components/common/ArtistBadge";
import StarttooLoader from "../components/loader/StarttooLoader";
import useAccountSearch from "../hooks/queries/useAccountSearch";
import useArtists from "../hooks/queries/useArtists";
import { ApiError } from "../services/api";
import { isSearchableQuery } from "../types/search";
import { profilePath, resolveAvatar } from "../utils/profile";
import ArtistSearchBar from "../components/artist/ArtistSearchBar";
import { mockArtists } from "../mocks/community";
import { QA_MOCK_DATA_ENABLED } from "../config/qa";

/**
 * 타투이스트 모아보기 — 검색어 하나로 도시와 닉네임을 함께 찾는다.
 *
 * 서버에 두 조건을 함께 받는 엔드포인트가 없어 두 API를 동시에 부르고 결과를
 * 나눠 보여준다.
 *   도시   GET /artists?city=      shopCity 정확 일치 → 숍·작업물까지 담긴 카드
 *   닉네임 GET /search/artists?q=  인증 아티스트 인덱스 → 닉네임만 오는 목록
 *
 * 도시가 정확 일치라 닉네임을 넣으면 도시 쪽은 빈 결과가 온다. 그래서 사용자가
 * 기준을 고르지 않아도 오탐이 생기지 않는다.
 */
export default function TattooistPage() {
	const [searchParams] = useSearchParams();
	const query = searchParams.get("q")?.trim() ?? "";
	const isSearching = query.length > 0;
	const loadMoreRef = useRef<HTMLDivElement>(null);

	// 검색어를 도시로 시도 — 비어 있으면 전체 목록이 된다
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
	} = useArtists({ size: 20, city: query || undefined });

	// 같은 검색어를 닉네임으로도 시도 (한 글자면 자동완성으로 전환된다)
	const {
		data: nicknameResults,
		isFetching: isNicknameFetching,
		isError: isNicknameError,
	} = useAccountSearch(query, { artistsOnly: true, size: 30 });

	const hasInvalidQuery = isSearching && !isSearchableQuery(query);

	const cityArtists = useMemo(() => {
		const items = data?.pages.flatMap((page) => page.items) ?? [];
		// 검색 중에 목업으로 덮으면 필터가 동작하는 것처럼 보인다
		return QA_MOCK_DATA_ENABLED && items.length === 0 && !isSearching
			? mockArtists
			: items;
	}, [data?.pages, isSearching]);

	const nicknameArtists = useMemo(() => {
		const accounts = nicknameResults ?? [];
		// 도시 결과에 이미 있는 사람은 아래 목록에서 뺀다
		const shown = new Set(cityArtists.map((artist) => artist.id));
		return accounts.filter((account) => !shown.has(account.userSeq));
	}, [nicknameResults, cityArtists]);

	const isSearchPending = isSearching && (isPending || isNicknameFetching);
	const hasNoResult =
		isSearching &&
		!isSearchPending &&
		cityArtists.length === 0 &&
		nicknameArtists.length === 0;
	/** 두 종류가 함께 나올 때만 어느 기준으로 걸렸는지 알려 준다 */
	const showSectionLabels =
		isSearching && cityArtists.length > 0 && nicknameArtists.length > 0;

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
			: "타투이스트 목록을 불러오지 못했습니다.";

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface pb-28 pt-5 lg:pb-16 lg:pt-8">
			<div className="mx-auto flex w-full max-w-[820px] flex-col gap-5 px-4 lg:gap-6">
				<div className="hidden max-lg:block [&>div>div]:h-12 [&>div>div]:shadow-none"><ArtistSearchBar /></div>

				{hasInvalidQuery && (
					<p className="py-16 text-center text-[14px] font-light leading-6 text-black/50">
						검색어에는 한글·영문·숫자만 쓸 수 있어요.
						<br />
						공백이나 특수문자를 빼고 다시 검색해 주세요.
					</p>
				)}

				{!hasInvalidQuery && (
					<>
						{isSearching && (
							<p className="text-[14px] font-light text-black/60">
								<span className="font-semibold text-black">
									&lsquo;{query}&rsquo;
								</span>{" "}
								검색 결과
							</p>
						)}

						{isSearchPending && <StarttooLoader variant="block" label="검색 중…" />}

						{!isSearching && isPending && cityArtists.length === 0 && (
							<StarttooLoader variant="block" label="타투이스트를 불러오는 중…" />
						)}

						{isError && isNicknameError && cityArtists.length === 0 && (
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

						{hasNoResult && (
							<p className="py-16 text-center text-[14px] font-light text-black/40">
								검색 결과가 없습니다.
							</p>
						)}

						{/* ─── 도시가 일치한 결과 (숍·작업물 카드) ─── */}
						{showSectionLabels && cityArtists.length > 0 && (
							<p className="text-[13px] font-semibold text-black/45">
								도시 &lsquo;{query}&rsquo;
							</p>
						)}

						{cityArtists.map((artist) => (
							<article
								key={artist.id}
								className="flex flex-col gap-4 rounded-[12px] bg-white p-4 shadow-sm lg:rounded-[20px] lg:p-6">
								<div className="flex items-center gap-4">
									<Link
										to={profilePath(artist.id)}
										aria-label={`${artist.name} 프로필`}>
										<img
											src={resolveAvatar(artist.avatarUrl, artist.name)}
											alt=""
											className="size-14 shrink-0 rounded-full bg-[#D9D9D9] object-cover transition hover:opacity-90"
										/>
									</Link>
									<div className="min-w-0 flex-1">
										<p className="flex items-center gap-1.5">
											<Link
												to={profilePath(artist.id)}
												className="truncate text-[16px] font-bold text-black hover:underline">
												{artist.name}
											</Link>
											{/* GET /artists는 VERIFIED만 반환한다 */}
											<ArtistBadge size={16} />
										</p>
										{artist.address && (
											<p className="mt-0.5 flex items-center gap-1.5 text-[13px]">
												<span className="truncate font-light text-black/45">
													{artist.address}
												</span>
											</p>
										)}
										{artist.hoursLabel && (
											<p className="mt-0.5 truncate text-[12px] font-light text-black/35">
												{artist.hoursLabel}
											</p>
										)}
									</div>
								</div>

								{/* 작업물 미리보기 — 모바일 4칸, 데스크톱 6칸 */}
								<div className="grid grid-cols-4 gap-1 lg:grid-cols-6 lg:gap-1.5">
									{Array.from({ length: 6 }, (_, i) => {
										const imageUrl = artist.imageUrls[i];
										return (
											<span
												key={i}
												className={`aspect-square overflow-hidden rounded-[4px] bg-[#D9D9D9] ${i >= 4 ? "max-lg:hidden" : ""}`}>
												{imageUrl && (
													<img
														src={imageUrl}
														alt=""
														className="h-full w-full object-cover"
													/>
												)}
											</span>
										);
									})}
								</div>
							</article>
						))}

						{/* ─── 닉네임이 일치한 결과 ─── */}
						{showSectionLabels && (
							<p className="mt-2 text-[13px] font-semibold text-black/45">
								닉네임 &lsquo;{query}&rsquo;
							</p>
						)}

						{nicknameArtists.length > 0 && (
							<ul className="flex flex-col gap-2">
								{nicknameArtists.map((account) => (
									<li key={account.userSeq}>
										<Link
											to={profilePath(account.userSeq)}
											className="flex items-center gap-4 rounded-[12px] bg-white p-4 shadow-sm transition hover:bg-black/[0.02] lg:rounded-[16px]">
											<img
												src={resolveAvatar(null, account.nickname)}
												alt=""
												className="size-12 shrink-0 rounded-full bg-[#D9D9D9] object-cover"
											/>
											<span className="flex min-w-0 items-center gap-1.5">
												<span className="truncate text-[15px] font-bold text-black">
													{account.nickname}
												</span>
												{/* 이 인덱스에는 VERIFIED 아티스트만 들어 있다 */}
												<ArtistBadge size={15} />
											</span>
										</Link>
									</li>
								))}
							</ul>
						)}

						{/* 도시·전체 목록만 커서 페이지네이션이 있다 */}
						{!isError && cityArtists.length > 0 && (
							<div ref={loadMoreRef} className="py-4 text-center">
								{isFetchingNextPage && (
									<div className="flex items-center justify-center gap-2 text-[13px] text-black/40">
										<StarttooLoader variant="mark" label={null} /> 더 불러오는
										중…
									</div>
								)}
								{!hasNextPage && !isFetchingNextPage && (
									<p className="text-[13px] text-black/30">마지막입니다</p>
								)}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
