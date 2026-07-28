import type { UserArtistInfo } from "../../types/user";

type MyPageShopInfoProps = {
	artist: UserArtistInfo | null | undefined;
	isLoading?: boolean;
};

function InfoRow({
	label,
	value,
}: {
	label: string;
	value: string | null | undefined;
}) {
	const trimmed = value?.trim();
	const isEmpty = !trimmed;

	return (
		<div className="flex items-start gap-5 px-6 py-1.5">
			<dt className="w-[76px] shrink-0 pt-px text-[13px] font-semibold text-black/40">
				{label}
			</dt>
			<dd className="min-w-0 flex-1">
				{isEmpty ? (
					<span className="text-[14px] font-light text-black/25">미등록</span>
				) : (
					<span className="whitespace-pre-wrap text-[14px] font-light leading-relaxed text-black/80">
						{trimmed}
					</span>
				)}
			</dd>
		</div>
	);
}

function formatShopAddress(
	artist: UserArtistInfo | null | undefined,
): string | null {
	if (!artist) return null;
	const parts = [artist.shopCity, artist.shopAddress].filter((part) =>
		part?.trim(),
	);
	return parts.length > 0 ? parts.join(" ") : null;
}

function LoadingRow() {
	return (
		<div className="flex items-center gap-5 px-6 py-1.5">
			<div className="h-3.5 w-14 shrink-0 animate-pulse rounded bg-black/5" />
			<div className="h-3.5 flex-1 animate-pulse rounded bg-black/5" />
		</div>
	);
}

/** 마이페이지 — 타투이스트 숍 정보 (읽기 전용) */
export default function MyPageShopInfo({
	artist,
	isLoading = false,
}: MyPageShopInfoProps) {
	if (isLoading) {
		return (
			<div className="mt-8 overflow-hidden rounded-[16px] border border-black/[0.06] bg-white py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
				<div className="flex flex-col">
					{Array.from({ length: 4 }, (_, i) => (
						<LoadingRow key={i} />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="mt-8 overflow-hidden rounded-[16px] border border-black/[0.06] bg-white py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
			<dl>
				<InfoRow label="매장명" value={artist?.shopName} />
				<InfoRow label="영업시간" value={artist?.businessHours} />
				<InfoRow label="전화번호" value={artist?.shopPhone} />
				<InfoRow label="매장주소" value={formatShopAddress(artist)} />
			</dl>
		</div>
	);
}
