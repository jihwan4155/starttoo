import { useState } from "react";

export type ArtistShopValues = {
	shopName: string | null;
	shopAddress: string | null;
};

type ArtistShopStepProps = {
	submitting: boolean;
	submitError: string | null;
	onSubmit: (values: ArtistShopValues) => void;
};

const inputClassName =
	"mt-2 h-[48px] w-full rounded-[10px] border border-[#D9D9D9] px-4 text-[15px] outline-none transition placeholder:text-[#999] focus:border-brand";

/**
 * 온보딩 3단계 — 타투이스트만 거치는 매장 정보 입력.
 *
 * 프로필 단계까지는 일반 사용자와 화면이 같고, 타투이스트를 고른 사람만 여기로 온다.
 * 두 칸 다 비워도 넘어갈 수 있다 — 승인 전에는 어차피 일반 사용자로 이용하고,
 * 매장 정보는 나중에 마이페이지에서 채울 수 있다.
 */
export default function ArtistShopStep({
	submitting,
	submitError,
	onSubmit,
}: ArtistShopStepProps) {
	const [shopName, setShopName] = useState("");
	const [shopAddress, setShopAddress] = useState("");

	const handleSubmit = () => {
		onSubmit({
			shopName: shopName.trim() || null,
			shopAddress: shopAddress.trim() || null,
		});
	};

	return (
		<div>
			<label
				htmlFor="onboarding-shop-name"
				className="block text-[13px] font-semibold text-black/60">
				매장이름
			</label>
			<input
				id="onboarding-shop-name"
				value={shopName}
				onChange={(event) => setShopName(event.target.value)}
				placeholder="매장이름"
				maxLength={100}
				className={inputClassName}
			/>

			<label
				htmlFor="onboarding-shop-address"
				className="mt-6 block text-[13px] font-semibold text-black/60">
				매장 위치
			</label>
			<input
				id="onboarding-shop-address"
				value={shopAddress}
				onChange={(event) => setShopAddress(event.target.value)}
				placeholder="서울시 강남구 테헤란로 123 2층"
				maxLength={255}
				className={inputClassName}
			/>
			<p className="mt-2 text-[12px] font-light leading-5 text-black/45">
				승인 전까지는 일반 사용자로 이용할 수 있어요. 비워 두면 나중에 마이페이지에서
				채울 수 있습니다.
			</p>

			{submitError && (
				<p role="alert" className="mt-5 text-[13px] leading-5 text-brand">
					{submitError}
				</p>
			)}

			<button
				type="button"
				onClick={handleSubmit}
				disabled={submitting}
				className="mx-auto mt-7 block h-[48px] w-[160px] rounded-full bg-brand text-[16px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#FFB4B4]">
				{submitting ? "저장하는 중…" : "다음"}
			</button>
		</div>
	);
}
