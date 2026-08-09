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
 * 타투이스트 모아보기
 *
 * 기본: GET /artists — 숍·작업물 카드 목록
 * 검색: GET /search/artists?q= — 인증 아티스트 닉네임 검색
 */
export default function TattooistPage() {
	const [searchParams] = useSearchParams();
	const query = searchParams.get("q")?.trim() ?? "";
	const isSearching = query.length > 0;
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const hasInvalidQuery = isSearching && !isSearchableQuery(query);

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
	} = useArtists({
		size: 20,
		enabled: !isSearching && !hasInvalidQuery,
	});

	const {
		data: nicknameResults,
		isFetching: isNicknameFetching,
		isError: isNicknameError,
		refetch: refetchNickname,
	} = useAccountSearch(query, { artistsOnly: true, size: 30 });

	const artists = useMemo(() => {
		const items = data?.pages.flatMap((page) => page.items) ?? [];
		return QA_MOCK_DATA_ENABLED && items.length === 0 ? mockArtists : items;
	}, [data?.pages]);

	const nicknameArtists = nicknameResults ?? [];
	const isSearchPending = isSearching && isNicknameFetching;
	const hasNoResult =
		isSearching && !isSearchPending && nicknameArtists.length === 0;

	useEffect(() => {
		const node = loadMoreRef.current;
		if (!node || isSearching) return;

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
	}, [fetchNextPage, hasNextPage, isFetchingNextPage, isError, isSearching]);

	const errorMessage =
		error instanceof ApiError
			? error.message
			: "타투이스트 목록을 불러오지 못했습니다.";

	return (
		<div className="min-h-[calc(100vh-var(--nav-h))] bg-surface pb-28 pt-5 lg:pb-16 lg:pt-8">
			<div className="mx-auto flex w-full max-w-[820px] flex-col gap-5 px-4 lg:gap-6">
				{/*
				  검색 바는 상단바에 놓일 때를 기준으로 520px 에서 멈추는데, 여기서는
				  아래 카드와 같은 폭이어야 목록의 머리처럼 읽힌다. 카드가 컨테이너를
				  꽉 채우므로 상한을 풀어 같이 늘고 줄게 한다.
				*/}
				<div className="hidden max-lg:block [&>div]:max-w-none">
					<ArtistSearchBar />
				</div>

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

						{isSearchPending && (
							<StarttooLoader variant="block" label="검색 중…" />
						)}

						{!isSearching && isPending && artists.length === 0 && (
							<StarttooLoader
								variant="block"
								label="타투이스트를 불러오는 중…"
							/>
						)}

						{!isSearching && isError && artists.length === 0 && (
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

						{isSearching &&
							isNicknameError &&
							nicknameArtists.length === 0 &&
							!isSearchPending && (
								<div className="flex flex-col items-center gap-4 py-20">
									<p className="text-center text-[14px] text-black/60">
										검색 결과를 불러오지 못했습니다.
									</p>
									<button
										type="button"
										onClick={() => void refetchNickname()}
										disabled={isNicknameFetching}
										className="rounded-full border border-black/20 px-5 py-2 text-[13px] font-semibold transition hover:bg-black/5 disabled:opacity-50">
										다시 시도
									</button>
								</div>
							)}

						{hasNoResult && !isNicknameError && (
							<p className="py-16 text-center text-[14px] font-light text-black/40">
								검색 결과가 없습니다.
							</p>
						)}

						{/* 검색: 닉네임 결과 */}
						{isSearching && nicknameArtists.length > 0 && (
							<ul className="flex flex-col gap-2">
								{nicknameArtists.map((account) => (
									<li key={account.userSeq}>
										<Link
											to={profilePath(account.userSeq)}
											className="flex items-center gap-4 rounded-[12px] bg-white p-4 shadow-sm transition hover:bg-black/[0.02] lg:rounded-[16px]">
											<img
												src={resolveAvatar(null, account.nickname)}
												alt=""
												className="size-12 shrink-0 rounded-full bg-white object-cover"
											/>
											<span className="flex min-w-0 items-center gap-1.5">
												<span className="truncate text-[15px] font-bold text-black">
													{account.nickname}
												</span>
												<ArtistBadge size={15} />
											</span>
										</Link>
									</li>
								))}
							</ul>
						)}

						{/* 기본 목록: 숍·작업물 카드 */}
						{!isSearching &&
							artists.map((artist) => (
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
												className="size-14 shrink-0 rounded-full bg-white object-cover transition hover:opacity-90"
											/>
										</Link>
										<div className="min-w-0 flex-1">
											<p className="flex items-center gap-1.5">
												<Link
													to={profilePath(artist.id)}
													className="truncate text-[16px] font-bold text-black hover:underline">
													{artist.name}
												</Link>
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

									{/* 작업물이 있을 때만 — 빈 칸을 회색으로 채우지 않는다 */}
									{artist.imageUrls.length > 0 && (
										<div className="grid grid-cols-4 gap-1 lg:grid-cols-6 lg:gap-1.5">
											{artist.imageUrls.slice(0, 6).map((imageUrl, i) => (
												<span
													key={i}
													className={`aspect-square overflow-hidden rounded-[4px] bg-[#D9D9D9] ${i >= 4 ? "max-lg:hidden" : ""}`}>
													<img
														src={imageUrl}
														alt=""
														className="h-full w-full object-cover"
													/>
												</span>
											))}
										</div>
									)}
								</article>
							))}

						{!isSearching && !isError && artists.length > 0 && (
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
