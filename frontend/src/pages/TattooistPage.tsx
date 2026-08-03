import { useEffect, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ArtistBadge from "../components/common/ArtistBadge";
import StarttooLoader from "../components/loader/StarttooLoader";
import useArtists from "../hooks/queries/useArtists";
import { ApiError } from "../services/api";
import { profilePath, resolveAvatar } from "../utils/profile";
import ArtistSearchBar from "../components/artist/ArtistSearchBar";
import { mockArtists } from "../mocks/community";
import { QA_MOCK_DATA_ENABLED } from "../config/qa";

/** 타투이스트 모아보기 — GET /artists */
export default function TattooistPage() {
	const [searchParams] = useSearchParams();
	const query = searchParams.get("q") ?? "";
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
	} = useArtists({
		size: 20,
		nickname: query.trim() || undefined,
	});

	const artists = useMemo(
		() => {
			const items = data?.pages.flatMap((page) => page.items) ?? [];
			const source = QA_MOCK_DATA_ENABLED && items.length === 0 ? mockArtists : items;
			const normalized = query.trim().toLowerCase();
			return normalized ? source.filter((artist) => artist.name.toLowerCase().includes(normalized) || artist.categories.some((category) => category.toLowerCase().includes(normalized))) : source;
		},
		[data?.pages, query],
	);

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
				{isPending && artists.length === 0 && (
					<StarttooLoader variant="block" label="타투이스트를 불러오는 중…" />
				)}

				{isError && artists.length === 0 && (
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

				{!isPending &&
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

				{!isPending && !isError && artists.length === 0 && (
					<p className="py-16 text-center text-[14px] font-light text-black/40">
						검색 결과가 없습니다.
					</p>
				)}

				{!isPending && !isError && artists.length > 0 && (
					<div ref={loadMoreRef} className="py-4 text-center">
						{isFetchingNextPage && (
							<div className="flex items-center justify-center gap-2 text-[13px] text-black/40">
								<StarttooLoader variant="mark" label={null} /> 더 불러오는 중…
							</div>
						)}
						{!hasNextPage && !isFetchingNextPage && (
							<p className="text-[13px] text-black/30">마지막입니다</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
