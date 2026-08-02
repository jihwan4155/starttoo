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

type SignupPhoneStepProps = {
	/** 상위에서 진행하는 가입 요청 중인지 */
	submitting: boolean;
	/** 가입 요청 중 발생한 오류 (상위에서 내려준다) */
	submitError: string | null;
	/** 서버가 정규화한 번호를 넘긴다 — 이 시점에 가입이 완료된다 */
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

	const digits = phone.replace(/\D/g, "");
	const canCheck = digits.length >= 10 && !checking;

	const handleCheck = async () => {
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
						setPhone(event.target.value);
						handleReset();
					}}
					inputMode="numeric"
					placeholder="010-1234-5678"
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
						{submitting ? "가입하는 중…" : "회원가입 완료"}
					</button>
				</>
			)}
		</div>
	);
}
