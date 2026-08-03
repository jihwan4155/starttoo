import type { ArtistProfileResponse } from "../../types/artist";
import type { UserArtistSummary } from "../../types/user";
import { formatApprovalStatus } from "../../utils/artistStatus";

type MyPageShopInfoProps = {
	/** GET /users/me · /users/{id} 의 artistProfile — 숍 이름·인증 상태만 들어 있다 */
	artist: UserArtistSummary | null | undefined;
	/**
	 * 숍 상세 — 도시·주소·전화·영업 안내까지 들어 있다.
	 *
	 * 내 마이페이지에서 GET /artists 조회로 채워진다. 인증 전이거나 남의
	 * 프로필이면 읽을 방법이 없어 비어 있고, 그때는 매장명·인증 상태만 보여준다.
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
 * detail이 있으면 매장명·영업시간·전화번호·매장주소를 모두 보여준다.
 * 없으면(인증 전이거나 남의 프로필) 읽을 수 있는 매장명·인증 상태만 보여준다.
 */
export default function MyPageShopInfo({
	artist,
	detail,
	isLoading = false,
}: MyPageShopInfoProps) {
	return (
		<div className="mt-6 rounded-[12px] border border-dashed border-black/15 px-7 py-5">
			{isLoading ? (
				<div className="flex flex-col">
					{Array.from({ length: 4 }, (_, i) => (
						<LoadingRow key={i} />
					))}
				</div>
			) : (
				<dl>
					<InfoRow label="매장명" value={detail?.shopName ?? artist?.shopName} />
					{detail ? (
						<>
							<InfoRow label="영업시간" value={detail.shopDetails} />
							<InfoRow label="전화번호" value={detail.shopPhone} />
							<InfoRow label="매장주소" value={formatShopAddress(detail)} />
						</>
					) : (
						<InfoRow
							label="인증 상태"
							value={formatApprovalStatus(artist?.verificationStatus)}
						/>
					)}
				</dl>
			)}
		</div>
	);
}
