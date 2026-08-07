import { formatApprovalStatus } from "../../utils/artistStatus";
import type { ArtistShopFormValues } from "./artistShopPatch";

const fieldClassName =
	"mt-2 h-[52px] w-full rounded-full border border-black/10 bg-white px-5 text-[14px] text-black outline-none placeholder:text-black/30 focus:border-brand/50";

const labelClassName = "text-[15px] font-bold text-black";

type ArtistShopProfileSectionProps = {
	values: ArtistShopFormValues;
	onChange: (patch: Partial<ArtistShopFormValues>) => void;
	verificationStatus: string | null;
	/**
	 * 현재 숍 정보를 서버에서 읽어와 채웠는지.
	 *
	 * 저장이 전체 덮어쓰기라, 못 읽어온 상태로 저장하면 빈 칸이 그대로 반영된다.
	 * 그 경우엔 다시 입력해야 한다고 알려 준다.
	 */
	isPrefilled: boolean;
};

/** PATCH /artists/me/profile — 숍 프로필 입력 섹션 */
export default function ArtistShopProfileSection({
	values,
	onChange,
	verificationStatus,
	isPrefilled,
}: ArtistShopProfileSectionProps) {
	return (
		<div className="mt-10 border-t border-black/10 pt-10">
			<h2 className="text-[18px] font-bold text-black">타투이스트 숍 정보</h2>
			<p className="mt-2 text-[13px] font-light leading-5 text-black/50">
				타투이스트 목록·프로필에 표시됩니다. 인증 상태는 변경할 수 없습니다.
			</p>

			<div className="mt-4 rounded-[10px] border border-black/10 bg-white px-4 py-3 text-[13px] text-black/60">
				<span className="font-semibold text-black/75">인증 상태</span>
				{" · "}
				{formatApprovalStatus(verificationStatus)}
			</div>

			{!isPrefilled && (
				<p className="mt-3 rounded-[10px] bg-brand/[0.07] px-4 py-3 text-[12px] font-light leading-5 text-black/70">
					인증이 끝나기 전에는 저장된 숍 정보를 다시 불러올 수 없어 아래 칸이 비어
					있습니다. 저장하면 빈 칸까지 그대로 반영되니, 남겨 둘 내용은 다시 입력해
					주세요.
				</p>
			)}

			<div className="mt-6 grid gap-x-8 gap-y-6 lg:grid-cols-2">
				<div>
					<p className={labelClassName}>매장이름</p>
					<input
						value={values.shopName}
						onChange={(e) => onChange({ shopName: e.target.value })}
						placeholder="싸피"
						maxLength={100}
						className={fieldClassName}
					/>
				</div>

				<div>
					<p className={labelClassName}>매장위치</p>
					<input
						value={values.shopAddress}
						onChange={(e) => onChange({ shopAddress: e.target.value })}
						placeholder="경기도 구미시 ~~~~"
						maxLength={255}
						className={fieldClassName}
					/>
				</div>

				<div>
					<p className={labelClassName}>전화번호</p>
					<input
						value={values.shopPhone}
						onChange={(e) => onChange({ shopPhone: e.target.value })}
						placeholder="010-1234-5678"
						maxLength={30}
						className={fieldClassName}
					/>
				</div>

				<div>
					<p className={labelClassName}>영업시간</p>
					<input
						value={values.shopDetails}
						onChange={(e) => onChange({ shopDetails: e.target.value })}
						placeholder="09:00 ~ 21:00"
						maxLength={1000}
						className={fieldClassName}
					/>
				</div>
			</div>

			<p className="mt-6 text-[12px] font-light leading-5 text-black/40">
				여기 입력한 매장명·영업시간·전화번호·주소가 마이페이지와 타투이스트
				프로필에 그대로 표시됩니다. 저장하면 이 화면의 내용으로 전체가 바뀝니다.
			</p>
		</div>
	);
}
