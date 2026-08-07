import type { ArtistProfileResponse } from "../../types/artist";
import type { UserArtistSummary } from "../../types/user";

type MyPageShopInfoProps = {
	/** GET /users/me · /users/{id} 의 artistProfile — 숍 이름·인증 상태만 들어 있다 */
	artist: UserArtistSummary | null | undefined;
	/**
	 * 숍 상세 — 도시·주소·전화·영업 안내까지 들어 있다.
	 *
	 * GET /artists 목록에서 해당 유저를 찾아 채운다. 인증 전이면 목록에 없어
	 * 비어 있고, 그때는 매장명만 summary에서 가져와 나머지 칸은 미등록으로 둔다.
	 */
	detail?: ArtistProfileResponse | null;
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

	return (
		<div className="flex items-start gap-6 py-1.5">
			<dt className="w-[68px] shrink-0 pt-px text-[14px] font-light text-black/45">
				{label}
			</dt>
			<dd className="min-w-0 flex-1">
				{trimmed ? (
					<span className="whitespace-pre-wrap text-[14px] font-light leading-relaxed text-black/80">
						{trimmed}
					</span>
				) : (
					<span className="text-[14px] font-light text-black/25">미등록</span>
				)}
			</dd>
		</div>
	);
}

function LoadingRow() {
	return (
		<div className="flex items-center gap-6 py-2">
			<div className="h-3.5 w-14 shrink-0 animate-pulse rounded bg-black/5" />
			<div className="h-3.5 flex-1 animate-pulse rounded bg-black/5" />
		</div>
	);
}

/** 도시가 주소에 이미 들어 있으면 중복해서 붙이지 않는다 */
function formatShopAddress(detail: ArtistProfileResponse): string | null {
	const address = detail.shopAddress?.trim();
	const city = detail.shopCity?.trim();
	if (!address) return city || null;
	if (city && !address.includes(city)) return `${city} ${address}`;
	return address;
}

/**
 * 타투이스트 숍 정보 (읽기 전용)
 *
 * 내 마이페이지·상대 프로필 모두 매장명·영업시간·전화번호·매장주소를 보여준다.
 */
export default function MyPageShopInfo({
	artist,
	detail,
	isLoading = false,
}: MyPageShopInfoProps) {
	return (
		<div className="mx-4 mt-3 overflow-hidden rounded-[12px] border border-black/[0.06] bg-white px-4 py-3 shadow-[0_1px_8px_rgba(0,0,0,0.04)] lg:mx-0 lg:mt-8 lg:rounded-[16px] lg:px-5 lg:py-4">
			{isLoading ? (
				<div className="flex flex-col">
					{Array.from({ length: 4 }, (_, i) => (
						<LoadingRow key={i} />
					))}
				</div>
			) : (
				<dl>
					<InfoRow label="매장명" value={detail?.shopName ?? artist?.shopName} />
					<InfoRow label="영업시간" value={detail?.shopDetails} />
					<InfoRow label="전화번호" value={detail?.shopPhone} />
					<InfoRow
						label="매장주소"
						value={detail ? formatShopAddress(detail) : null}
					/>
				</dl>
			)}
		</div>
	);
}
