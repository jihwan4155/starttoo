import { useMemo, useState } from "react";
import ArtistBadge from "../components/common/ArtistBadge";
import { MOCK_ARTISTS } from "../mocks/artists";

/** 타투이스트 모아보기 — 시연용 목업 (TODO: GET /artists 연동) */
export default function TattooistPage() {
	const [query, setQuery] = useState("");

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
				{/* 검색 */}
				<label className="flex h-[46px] items-center gap-2.5 rounded-full border border-black/10 bg-white px-5 shadow-sm">
					<svg width="18" height="18" viewBox="0 0 28 28" fill="none" aria-hidden>
						<circle cx="12.5" cy="12.5" r="7.5" stroke="#999" strokeWidth="2.2" />
						<path
							d="m18.5 18.5 5.5 5.5"
							stroke="#999"
							strokeWidth="2.2"
							strokeLinecap="round"
						/>
					</svg>
					<input
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="타투이스트 검색"
						className="w-full bg-transparent text-[14px] text-black outline-none placeholder:font-light placeholder:text-black/35"
					/>
				</label>

				{/* 타투이스트 카드 목록 */}
				{artists.map((artist) => (
					<article
						key={artist.id}
						className="flex flex-col gap-4 rounded-[20px] bg-white p-6 shadow-sm">
						<div className="flex items-center gap-4">
							<span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#D9D9D9] text-[12px] font-light text-black/40">
								프사
							</span>
							<div className="min-w-0 flex-1">
								<p className="flex items-center gap-1.5">
									<span className="truncate text-[16px] font-bold text-black">
										{artist.name}
									</span>
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

						{/* 작업물 미리보기 (TODO: 이미지 연동) */}
						<div className="grid grid-cols-6 gap-1.5">
							{Array.from({ length: 6 }, (_, i) => (
								<span
									key={i}
									className="aspect-square rounded-[4px] bg-[#D9D9D9]"
								/>
							))}
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
