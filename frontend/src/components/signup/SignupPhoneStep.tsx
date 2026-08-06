import { useState } from "react";
import { Link } from "react-router-dom";
import { PHONE_CONFIRM_CODE } from "../../constants/auth";
import { ApiError } from "../../services/api";
import { checkPhoneAvailability } from "../../services/authApi";
import type { SocialProvider } from "../../types/auth";

const PROVIDER_LABEL: Record<SocialProvider, string> = {
	GOOGLE: "Google",
	KAKAO: "카카오",
};

/** 백엔드가 받는 형식(PhoneNumberNormalizer) — 010 + 8자리뿐이다 */
const KOREAN_MOBILE = /^010\d{8}$/;

/**
 * 형식이 어긋난 이유를 사람이 읽을 문장으로 돌려준다. 맞으면 null.
 *
 * 서버도 같은 검사를 하지만 실패 문구가 "한국 모바일 E.164 형식이어야 합니다"라서
 * 그대로 노출할 수 없다. 요청을 보내기 전에 여기서 먼저 걸러 안내한다.
 */
function phoneFormatError(digits: string): string | null {
	if (digits.length === 0) return "휴대폰 번호를 입력해주세요.";
	if (!digits.startsWith("010")) {
		return "010으로 시작하는 휴대폰 번호를 입력해주세요.";
	}
	if (digits.length < 11) {
		return `휴대폰 번호 11자리를 모두 입력해주세요. (${digits.length}/11)`;
	}
	if (!KOREAN_MOBILE.test(digits)) {
		return "휴대폰 번호를 다시 확인해주세요. 예) 01012345678";
	}
	return null;
}

type SignupPhoneStepProps = {
	/** 상위에서 진행하는 요청 중인지 */
	submitting: boolean;
	/** 상위에서 내려준 오류 */
	submitError: string | null;
	/**
	 * 서버가 정규화한 번호를 넘긴다.
	 *
	 * 가입은 여기서 끝나지 않는다 — 역할까지 고른 뒤에 signup을 부르므로
	 * 이 콜백은 다음 단계로 넘기는 역할만 한다.
	 */
	onConfirmed: (normalizedPhoneNumber: string) => void;
};

export default function SignupPhoneStep({
	submitting,
	submitError,
	onConfirmed,
}: SignupPhoneStepProps) {
	const [phone, setPhone] = useState("");
	const [checking, setChecking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	/** 이미 다른 소셜 계정으로 가입된 번호일 때 로그인 유도 버튼을 띄운다 */
	const [existingProvider, setExistingProvider] = useState<string | null>(
		null,
	);
	/** 중복 검사를 통과한 뒤에만 확인 코드 입력을 연다 */
	const [available, setAvailable] = useState<string | null>(null);
	const [code, setCode] = useState("");

	// phone은 입력 단계에서 숫자만 남기므로 하이픈·공백이 섞여 있지 않다.
	const canCheck = phone.length > 0 && !checking;

	const handleCheck = async () => {
		// 자리수·시작번호가 어긋나면 요청 전에 안내한다 (서버 문구는 기술 용어라 쓸 수 없다).
		const formatError = phoneFormatError(phone);
		if (formatError) {
			setError(formatError);
			return;
		}
		setError(null);
		setChecking(true);
		try {
			const result = await checkPhoneAvailability(phone);
			if (!result.available) {
				// 백엔드는 이미 가입된 번호에 다른 소셜 계정을 연결하지 않고 거부한다.
				const provider = result.provider
					? PROVIDER_LABEL[result.provider]
					: null;
				if (provider) {
					// 기존 가입 제공자를 알려주고 로그인 화면으로 안내한다.
					setExistingProvider(provider);
					setError(
						`이미 ${provider} 계정으로 가입된 번호예요. ${provider} 로그인으로 이용해주세요.`,
					);
					return;
				}
				setError("사용할 수 없는 휴대폰 번호입니다.");
				return;
			}
			setAvailable(result.normalizedPhoneNumber);
		} catch (cause) {
			// 서버의 형식 오류 문구("한국 모바일 E.164 형식…")는 사용자에게 의미가 없어
			// 위 검사를 빠져나온 경우에도 같은 안내로 바꿔서 보여준다.
			if (cause instanceof ApiError && cause.code === "INVALID_REQUEST") {
				setError("휴대폰 번호를 다시 확인해주세요. 예) 01012345678");
				return;
			}
			setError(
				cause instanceof ApiError
					? cause.message
					: "번호를 확인하지 못했습니다.",
			);
		} finally {
			setChecking(false);
		}
	};

	const handleReset = () => {
		setAvailable(null);
		setCode("");
		setError(null);
		setExistingProvider(null);
	};

	return (
		<div className="w-full max-w-[360px]">
			<h1 className="text-center text-[24px] font-extrabold text-black">
				휴대폰 번호
			</h1>
			<p className="mt-2 text-center text-[13px] font-light leading-5 text-black/55">
				중복 가입을 막기 위해 확인합니다.
			</p>

			<label className="mt-8 block text-[13px] font-semibold text-black/60">
				휴대폰 번호
			</label>
			<div className="mt-2 flex gap-2">
				<input
					value={phone}
					onChange={(event) => {
						// 하이픈·공백을 눌러도 무시하고 숫자 11자리까지만 받는다.
						setPhone(event.target.value.replace(/\D/g, "").slice(0, 11));
						handleReset();
					}}
					inputMode="numeric"
					maxLength={11}
					placeholder="01012345678"
					disabled={available !== null}
					className="h-[48px] min-w-0 flex-1 rounded-[10px] border border-[#D9D9D9] px-4 text-[15px] outline-none transition placeholder:text-[#999] focus:border-brand disabled:bg-black/[0.03]"
				/>
				<button
					type="button"
					onClick={handleCheck}
					disabled={!canCheck || available !== null}
					className="h-[48px] shrink-0 rounded-[10px] bg-black/80 px-4 text-[14px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-black/20">
					{checking ? "확인 중…" : "확인"}
				</button>
			</div>

			{error && (
				<p role="alert" className="mt-3 text-[13px] leading-5 text-brand">
					{error}
				</p>
			)}

			{existingProvider && (
				<Link
					to="/login"
					replace
					className="mt-4 flex h-[52px] w-full items-center justify-center rounded-[10px] bg-brand text-[16px] font-semibold text-white transition hover:brightness-95">
					{existingProvider} 로그인하러 가기
				</Link>
			)}

			{available && (
				<>
					<div className="mt-6 rounded-[10px] bg-brand/[0.06] p-4">
						<p className="text-[13px] font-semibold text-black">
							본인 번호가 맞다면 아래에 {PHONE_CONFIRM_CODE}을 입력하고
							회원가입을 계속하세요.
						</p>
						<p className="mt-1 text-[12px] font-light text-black/50">
							{available}
						</p>
					</div>
					<input
						value={code}
						onChange={(event) => setCode(event.target.value)}
						inputMode="numeric"
						placeholder={PHONE_CONFIRM_CODE}
						aria-label="확인 코드"
						className="mt-3 h-[48px] w-full rounded-[10px] border border-[#D9D9D9] px-4 text-center text-[18px] tracking-[0.3em] outline-none transition placeholder:tracking-normal placeholder:text-[#CCC] focus:border-brand"
					/>
					{submitError && (
						<p role="alert" className="mt-4 text-[13px] leading-5 text-brand">
							{submitError}
						</p>
					)}
					<button
						type="button"
						onClick={() => onConfirmed(available)}
						disabled={code.trim() !== PHONE_CONFIRM_CODE || submitting}
						className="mt-4 h-[52px] w-full rounded-[10px] bg-brand text-[16px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#FFB4B4]">
						{submitting ? "확인 중…" : "다음"}
					</button>
				</>
			)}
		</div>
	);
}
