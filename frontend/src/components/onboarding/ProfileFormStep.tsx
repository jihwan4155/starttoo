import { useState } from "react";
import { ApiError } from "../../services/api";
import { checkNicknameAvailability } from "../../services/authApi";
import type { RequestedRole, SignupGender } from "../../types/auth";
import { birthDateMessage, formatBirthDigits } from "../../utils/birthDate";

/** 백엔드 UpdateProfileRequest.nickname 과 같은 제약 */
const NICKNAME_PATTERN = /^[가-힣A-Za-z0-9]{2,20}$/;

const GENDERS: { value: SignupGender; label: string }[] = [
	{ value: "M", label: "남자" },
	{ value: "F", label: "여자" },
];

export type ProfileFormValues = {
	nickname: string;
	/** YYYY-MM-DD — 8자리를 다 채워야 다음으로 넘어가므로 항상 값이 있다 */
	birthDate: string;
	gender: SignupGender;
	/** 타투이스트일 때만 채운다 */
	shopName: string | null;
	shopAddress: string | null;
};

type ProfileFormStepProps = {
	role: RequestedRole;
	/**
	 * 가입 때 배정된 임시 닉네임.
	 * 이미 내 것이라 그대로 두면 중복 확인이 필요 없고, 바꾸면 다시 확인해야 한다.
	 */
	assignedNickname: string;
	submitting: boolean;
	submitError: string | null;
	onSubmit: (values: ProfileFormValues) => void;
};

/**
 * 온보딩 2단계 — 프로필 입력.
 *
 * 타투이스트는 여기서 매장 정보를 함께 받는다. 일반 사용자와 다른 부분은 그 두 칸뿐이다.
 */
export default function ProfileFormStep({
	role,
	assignedNickname,
	submitting,
	submitError,
	onSubmit,
}: ProfileFormStepProps) {
	const [nickname, setNickname] = useState(assignedNickname);
	// 화면에 보이는 하이픈은 표시용이라, 상태에는 숫자만 담는다.
	const [birthDigits, setBirthDigits] = useState("");
	const [gender, setGender] = useState<SignupGender | null>(null);
	const [shopName, setShopName] = useState("");
	const [shopAddress, setShopAddress] = useState("");

	const [checking, setChecking] = useState(false);
	const [nicknameError, setNicknameError] = useState<string | null>(null);
	/** 중복 확인을 통과한 닉네임 — 값이 바뀌면 다시 확인해야 한다 */
	const [confirmed, setConfirmed] = useState<string | null>(null);

	const formatValid = NICKNAME_PATTERN.test(nickname);
	// 배정받은 닉네임을 그대로 쓰면 이미 내 것이므로 확인이 필요 없다.
	const needsCheck = nickname !== assignedNickname;
	const nicknameReady = formatValid && (!needsCheck || confirmed === nickname);

	const birthError = birthDateMessage(birthDigits);
	const birthReady = birthDigits.length === 8 && birthError === null;

	const handleCheck = async () => {
		setNicknameError(null);
		setChecking(true);
		try {
			const result = await checkNicknameAvailability(nickname);
			if (!result.available) {
				setNicknameError("이미 사용 중인 닉네임입니다.");
				return;
			}
			setConfirmed(nickname);
		} catch (cause) {
			setNicknameError(
				cause instanceof ApiError
					? cause.message
					: "닉네임을 확인하지 못했습니다.",
			);
		} finally {
			setChecking(false);
		}
	};

	const updateNickname = (value: string) => {
		setNickname(value);
		setConfirmed(null);
		setNicknameError(null);
	};

	const handleSubmit = () => {
		// 버튼이 이미 막혀 있지만, 타입을 좁히려면 여기서도 확인해야 한다.
		if (!birthReady || gender === null) return;
		onSubmit({
			nickname,
			// 8자리를 통과했으므로 이 결과가 곧 YYYY-MM-DD다.
			birthDate: formatBirthDigits(birthDigits),
			gender,
			shopName: shopName.trim() || null,
			shopAddress: shopAddress.trim() || null,
		});
	};

	return (
		<div>
			<label
				htmlFor="onboarding-nickname"
				className="block text-[13px] font-semibold text-black/60">
				닉네임
			</label>
			<div className="mt-2 flex gap-2">
				<input
					id="onboarding-nickname"
					value={nickname}
					onChange={(event) => updateNickname(event.target.value)}
					placeholder="닉네임"
					maxLength={20}
					className="h-[48px] min-w-0 flex-1 rounded-[10px] border border-[#D9D9D9] px-4 text-[15px] outline-none transition placeholder:text-[#999] focus:border-brand"
				/>
				<button
					type="button"
					onClick={handleCheck}
					disabled={!formatValid || !needsCheck || checking}
					className="h-[48px] shrink-0 rounded-[10px] bg-brand px-4 text-[14px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#FFB4B4]">
					{checking ? "확인 중…" : "중복확인"}
				</button>
			</div>
			{nickname && !formatValid && (
				<p className="mt-2 text-[13px] text-black/50">
					2~20자의 한글·영문·숫자만 사용할 수 있어요.
				</p>
			)}
			{/* 통과 안내는 회색 — 빨강은 고쳐야 할 것에만 쓴다 */}
			{confirmed === nickname && needsCheck && (
				<p className="mt-2 text-[13px] text-black/50">
					사용할 수 있는 닉네임이에요.
				</p>
			)}
			{nicknameError && (
				<p role="alert" className="mt-2 text-[13px] text-brand">
					{nicknameError}
				</p>
			)}

			<label
				htmlFor="onboarding-birthdate"
				className="mt-6 block text-[13px] font-semibold text-black/60">
				생년월일
			</label>
			{/*
			  날짜 선택기(type="date")가 아니라 숫자 입력이다. 생년월일은 몇십 년을
			  거슬러야 해서 달력으로 고르면 클릭이 수십 번 필요하고, 연/월/일 드롭다운도
			  연도 목록이 100개가 넘는다. 8자리를 그냥 치는 게 가장 빠르다.
			  inputMode="numeric"으로 모바일에서는 숫자 키패드가 바로 뜬다.
			*/}
			<input
				id="onboarding-birthdate"
				value={formatBirthDigits(birthDigits)}
				onChange={(event) =>
					setBirthDigits(event.target.value.replace(/\D/g, "").slice(0, 8))
				}
				inputMode="numeric"
				autoComplete="bday"
				placeholder="YYYYMMDD"
				// 하이픈 2개까지 포함한 길이 — 하이픈은 우리가 끼운다
				maxLength={10}
				aria-invalid={birthError !== null}
				aria-describedby="onboarding-birthdate-help"
				className="mt-2 h-[48px] w-full rounded-[10px] border border-[#D9D9D9] px-4 text-[15px] outline-none transition placeholder:text-[#999] focus:border-brand"
			/>
			{birthError ? (
				<p
					id="onboarding-birthdate-help"
					role="alert"
					className="mt-2 text-[13px] text-brand">
					{birthError}
				</p>
			) : (
				<p
					id="onboarding-birthdate-help"
					className="mt-2 text-[13px] text-black/50">
					숫자 8자리로 입력해주세요.
				</p>
			)}

			<p className="mt-6 text-[13px] font-semibold text-black/60">성별</p>
			<div
				role="group"
				aria-label="성별"
				className="mt-2 flex overflow-hidden rounded-[10px] border border-[#D9D9D9]">
				{GENDERS.map((option, index) => {
					const active = gender === option.value;
					return (
						<button
							key={option.value}
							type="button"
							onClick={() => setGender(option.value)}
							aria-pressed={active}
							className={`h-[48px] flex-1 text-[14px] font-semibold transition ${
								index > 0 ? "border-l border-[#D9D9D9]" : ""
							} ${
								active
									? "bg-brand text-white"
									: "bg-white text-black/70 hover:bg-black/5"
							}`}>
							{option.label}
						</button>
					);
				})}
			</div>

			{role === "ARTIST" && (
				<>
					<label
						htmlFor="onboarding-shop-name"
						className="mt-6 block text-[13px] font-semibold text-black/60">
						매장이름
					</label>
					<input
						id="onboarding-shop-name"
						value={shopName}
						onChange={(event) => setShopName(event.target.value)}
						placeholder="매장이름"
						maxLength={100}
						className="mt-2 h-[48px] w-full rounded-[10px] border border-[#D9D9D9] px-4 text-[15px] outline-none transition placeholder:text-[#999] focus:border-brand"
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
						className="mt-2 h-[48px] w-full rounded-[10px] border border-[#D9D9D9] px-4 text-[15px] outline-none transition placeholder:text-[#999] focus:border-brand"
					/>
					<p className="mt-2 text-[12px] font-light leading-5 text-black/45">
						승인 전까지는 일반 사용자로 이용할 수 있어요. 비워 두면 나중에
						마이페이지에서 채울 수 있습니다.
					</p>
				</>
			)}

			{submitError && (
				<p role="alert" className="mt-5 text-[13px] leading-5 text-brand">
					{submitError}
				</p>
			)}

			<button
				type="button"
				onClick={handleSubmit}
				disabled={!nicknameReady || !birthReady || gender === null || submitting}
				className="mx-auto mt-7 block h-[48px] w-[160px] rounded-full bg-brand text-[16px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#FFB4B4]">
				{submitting ? "저장하는 중…" : "다음"}
			</button>
		</div>
	);
}
