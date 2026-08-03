import { formatApprovalStatus } from "../../utils/artistStatus";
import type { ArtistShopFormValues } from "./artistShopPatch";

const fieldClassName =
	"mt-2 h-[52px] w-full rounded-[10px] border border-black/10 bg-white px-4 text-[14px] text-black outline-none placeholder:text-black/35 focus:border-brand/50";

type ArtistShopProfileSectionProps = {
	values: ArtistShopFormValues;
	onChange: (patch: Partial<ArtistShopFormValues>) => void;
	verificationStatus: string | null;
};

/** PATCH /artists/me/profile — 숍 프로필 입력 섹션 */
export default function ArtistShopProfileSection({
	values,
	onChange,
	verificationStatus,
}: ArtistShopProfileSectionProps) {
	return (
		<div className="mt-10 border-t border-black/10 pt-10">
			<h2 className="text-[18px] font-bold text-black">타투이스트 숍 정보</h2>
			<p className="mt-2 text-[13px] font-light text-black/50">
				타투이스트 목록·프로필에 표시됩니다. 인증 상태는 변경할 수 없습니다.
			</p>

			<div className="mt-4 rounded-[10px] border border-black/10 bg-white px-4 py-3 text-[13px] text-black/60">
				<span className="font-semibold text-black/75">인증 상태</span>
				{" · "}
				{formatApprovalStatus(verificationStatus)}
			</div>

			<div className="mt-6">
				<p className="text-[16px] font-bold text-black">숍 이름</p>
				<input
					value={values.shopName}
					onChange={(e) => onChange({ shopName: e.target.value })}
					placeholder="예: 서울잉크 스튜디오"
					maxLength={100}
					className={fieldClassName}
				/>
			</div>

			<div className="mt-6">
				<p className="text-[16px] font-bold text-black">도시</p>
				<p className="mt-1 text-[12px] text-black/45">
					&apos;시&apos;를 제외한 도시명 (예: 서울, 부산)
				</p>
				<input
					value={values.shopCity}
					onChange={(e) => onChange({ shopCity: e.target.value })}
					placeholder="서울"
					maxLength={100}
					className={fieldClassName}
				/>
			</div>

			<div className="mt-6">
				<p className="text-[16px] font-bold text-black">주소</p>
				<input
					value={values.shopAddress}
					onChange={(e) => onChange({ shopAddress: e.target.value })}
					placeholder="서울 마포구 월드컵북로 10"
					maxLength={255}
					className={fieldClassName}
				/>
			</div>

			<div className="mt-6">
				<p className="text-[16px] font-bold text-black">전화번호</p>
				<input
					value={values.shopPhone}
					onChange={(e) => onChange({ shopPhone: e.target.value })}
					placeholder="02-1234-5678"
					maxLength={30}
					className={fieldClassName}
				/>
			</div>

			<div className="mt-6">
				<p className="text-[16px] font-bold text-black">영업 안내</p>
				<p className="mt-1 text-[12px] text-black/45">
					영업시간·휴무일·예약 방식을 자유롭게 적어 주세요.
				</p>
				<textarea
					value={values.shopDetails}
					onChange={(e) => onChange({ shopDetails: e.target.value })}
					placeholder="평일 12:00~21:00, 예약제"
					maxLength={1000}
					rows={3}
					className="mt-2 w-full resize-none rounded-[10px] border border-black/10 bg-white px-4 py-3 text-[14px] text-black outline-none placeholder:text-black/35 focus:border-brand/50"
				/>
			</div>

			<p className="mt-4 text-[12px] font-light leading-5 text-black/40">
				도시·주소·전화번호·영업 안내는 조회 API가 없어 저장 후 이 화면에 다시
				표시되지 않습니다. 비워 두면 기존 값을 그대로 유지합니다.
			</p>
		</div>
	);
}
