import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ArtistBadge from "../components/common/ArtistBadge";
import { MOCK_ARTISTS } from "../mocks/artists";
import { profilePath, resolveAvatar } from "../utils/profile";

/** 타투이스트 모아보기 — 시연용 목업 (TODO: GET /artists 연동) */
export default function TattooistPage() {
	// 검색은 상단 헤더(ArtistSearchBar)에서 입력 → URL ?q=로 동기화
	const [searchParams] = useSearchParams();
	const query = searchParams.get("q") ?? "";

	const artists = useMemo(() => {
		const keyword = query.trim();
		if (!keyword) return MOCK_ARTISTS;
		return MOCK_ARTISTS.filter(
			(artist) =>
				artist.name.includes(keyword) ||
				artist.categories.some((category) => category.includes(keyword)),
		);
	}, [query]);

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface pb-16 pt-8">
			<div className="mx-auto flex w-full max-w-[820px] flex-col gap-6 px-4">
				{/* 타투이스트 카드 목록 */}
				{artists.map((artist) => (
					<article
						key={artist.id}
						className="flex flex-col gap-4 rounded-[20px] bg-white p-6 shadow-sm">
						<div className="flex items-center gap-4">
							<Link
								to={profilePath(artist.name)}
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
										to={profilePath(artist.name)}
										className="truncate text-[16px] font-bold text-black hover:underline">
										{artist.name}
									</Link>
									<ArtistBadge size={16} />
								</p>
								<p className="mt-0.5 text-[13px] font-light text-black/45">
									{artist.isOpen ? "영업 중" : "영업 종료"}
									<span className="mx-1.5">·</span>
									{artist.hoursLabel}
								</p>
								<p className="mt-0.5 flex items-center gap-1.5 text-[13px]">
									{artist.distanceKm != null && (
										<span className="font-semibold text-black">
											{artist.distanceKm}km
										</span>
									)}
									<span className="truncate font-light text-black/45">
										{artist.address}
									</span>
								</p>
							</div>
						</div>

						{/* 장르 태그 */}
						<div className="flex flex-wrap gap-1.5">
							{artist.categories.map((category) => (
								<span
									key={category}
									className="rounded-[6px] bg-[#1A1A1A] px-2.5 py-1 text-[12px] font-medium text-white">
									{category}
								</span>
							))}
						</div>

						{/* 작업물 미리보기 — 탐색 게시글 이미지, 없으면 회색 플레이스홀더 */}
						<div className="grid grid-cols-6 gap-1.5">
							{Array.from({ length: 6 }, (_, i) => {
								const imageUrl = artist.imageUrls[i];
								return (
									<span
										key={i}
										className="aspect-square overflow-hidden rounded-[4px] bg-[#D9D9D9]">
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

				{artists.length === 0 && (
					<p className="py-16 text-center text-[14px] font-light text-black/40">
						검색 결과가 없습니다.
					</p>
				)}
			</div>
		</div>
	);
}
