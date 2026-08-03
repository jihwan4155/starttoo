import type { UserArtistSummary } from "../../types/user";
import { formatApprovalStatus } from "../../utils/artistStatus";

type MyPageShopInfoProps = {
	artist: UserArtistSummary | null | undefined;
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
		<div className="flex items-start gap-5 px-6 py-1.5">
			<dt className="w-[76px] shrink-0 pt-px text-[13px] font-semibold text-black/40">
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
		<div className="flex items-center gap-5 px-6 py-1.5">
			<div className="h-3.5 w-14 shrink-0 animate-pulse rounded bg-black/5" />
			<div className="h-3.5 flex-1 animate-pulse rounded bg-black/5" />
		</div>
	);
}

/**
 * 타투이스트 숍 정보 (읽기 전용)
 *
 * 서버가 프로필 조회에 실어 주는 숍 필드는 매장명·인증 상태 둘뿐이다.
 * 도시·주소·전화·영업안내는 PATCH /artists/me/profile 응답에만 있고 조회 API가
 * 없어서 여기서는 보여줄 수 없다.
 */
export default function MyPageShopInfo({
	artist,
	isLoading = false,
}: MyPageShopInfoProps) {
	return (
		<div className="mt-8 overflow-hidden rounded-[16px] border border-black/[0.06] bg-white py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
			{isLoading ? (
				<div className="flex flex-col">
					{Array.from({ length: 2 }, (_, i) => (
						<LoadingRow key={i} />
					))}
				</div>
			) : (
				<dl>
					<InfoRow label="매장명" value={artist?.shopName} />
					<InfoRow
						label="인증 상태"
						value={formatApprovalStatus(artist?.verificationStatus)}
					/>
				</dl>
			)}
		</div>
	);
}
