import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import OnboardingDialog from "../components/onboarding/OnboardingDialog";
import RoleAskStep from "../components/onboarding/RoleAskStep";
import DataConsentStep from "../components/signup/DataConsentStep";
import SignupPhoneStep from "../components/signup/SignupPhoneStep";
import { ApiError } from "../services/api";
import { signup, suggestNicknames } from "../services/authApi";
import useAuthStore from "../store/useAuthStore";
import useSignupStore from "../store/useSignupStore";
import type { RequestedRole } from "../types/auth";

/**
 * 가입 시점에 쓸 임시 닉네임.
 *
 * 번호 확인만 끝나면 곧바로 가입을 마치므로 이 시점에 이름이 하나 필요하다.
 * 서버 추천을 먼저 쓰고, 추천이 비었거나 실패해도 가입을 막지 않도록 후보를 직접 만든다.
 * 사용자는 다음 화면(온보딩)에서 바꿀 수 있다.
 */
async function assignNickname(): Promise<string> {
	try {
		const { items } = await suggestNicknames(1);
		if (items[0]) return items[0];
	} catch {
		// 추천 실패가 가입을 막을 이유는 없다.
	}
	return `타투인${Math.floor(Math.random() * 1_000_000)}`;
}

type Step = "phone" | "consent" | "role";

/**
 * 회원가입 플로우 — 전화번호 확인, 데이터 처리 동의, 그다음 역할 선택.
 *
 * 동의를 역할 선택 앞에 두는 이유는 어떤 역할로 가입하든 도안·프롬프트를 다루는
 * 것은 같아서다. 필수 항목에 동의해야 역할 화면으로 넘어간다.
 *
 * 역할을 여기서 묻는 이유가 있다. users.role은 가입 요청에서만 정해지고 이후
 * 바꾸는 API가 없다(PATCH /users/me는 닉네임·생년월일·성별만 받는다). 예전에는
 * 역할을 온보딩에서 물으면서 가입은 항상 USER로 했는데, 그러면 타투이스트를
 * 골라도 계정은 일반 사용자로 남아 숍 정보 저장(PATCH /artists/me/profile)이
 * 403이 되고 인증 뱃지 신청도 뜨지 않았다.
 *
 * 역할까지 고르면 가입을 끝내고 세션을 세운다. 닉네임·생년월일·성별은 이어지는
 * 온보딩에서 보강하며, 거기서 이탈해도 계정은 남는다.
 */
export default function SignupPage() {
	const navigate = useNavigate();
	const signupToken = useSignupStore((s) => s.signupToken);
	const setNickname = useSignupStore((s) => s.setNickname);
	const setStoredRole = useSignupStore((s) => s.setRole);
	const accessToken = useAuthStore((s) => s.accessToken);
	const setSession = useAuthStore((s) => s.setSession);

	const [step, setStep] = useState<Step>("phone");
	const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	// 세션이 있으면 가입은 이미 끝났다. 가입 성공 직후의 리렌더도 여기로 걸리므로
	// 라우터 이동이 늦게 반영돼도 /login으로 튕기지 않고 온보딩으로 간다.
	// 다만 가입 토큰이 없다면 방금 가입한 것이 아니라 기존 회원이 로그인한 채로
	// 이 경로에 닿은 것이다 — 온보딩으로 보내면 회원가입을 다시 시키는 꼴이 된다.
	if (accessToken) {
		return <Navigate to={signupToken ? "/onboarding" : "/"} replace />;
	}
	// 가입 토큰 없이 직접 들어온 경우 — 소셜 로그인부터 다시.
	if (!signupToken) {
		return <Navigate to="/login" replace />;
	}

	const handleConfirmed = (confirmed: string) => {
		setSubmitError(null);
		setPhoneNumber(confirmed);
		setStep("consent");
	};

	const handleConsent = () => {
		setStep("role");
	};

	const handleRoleSelect = async (isArtist: boolean) => {
		if (!phoneNumber || submitting) return;
		const role: RequestedRole = isArtist ? "ARTIST" : "USER";
		setSubmitError(null);
		setSubmitting(true);
		try {
			const nickname = await assignNickname();
			// ARTIST로 보내면 서버가 users.role=ARTIST로 만들고 artists 행을
			// UNVERIFIED로 함께 생성한다. 인증은 그 뒤 별도 절차다.
			const tokens = await signup({
				signupToken,
				phoneNumber,
				nickname,
				role,
			});
			setSession({
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken,
			});
			// 온보딩 닉네임 입력의 초기값으로 쓴다.
			setNickname(nickname);
			// 온보딩이 매장 정보 단계를 띄울지 판단하는 데 쓴다.
			setStoredRole(role);
			// 가입 토큰은 여기서 지우지 않는다. zustand 갱신은 동기라 즉시 리렌더되는데
			// react-router의 이동은 transition이라 뒤늦게 반영된다. 지금 지우면 아직
			// 이 화면인 채로 위의 가입 토큰 가드가 먼저 돌아 /login으로 튕겨 버린다.
			// 가입 재료는 온보딩을 빠져나갈 때 clearSignup()으로 한 번에 정리한다.
			navigate("/onboarding", { replace: true });
		} catch (cause) {
			// 번호 확인 이후 다른 사람이 같은 번호로 가입했을 수 있어
			// 서버가 가입 트랜잭션에서 한 번 더 검증한다.
			setSubmitError(
				cause instanceof ApiError
					? cause.message
					: "회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.",
			);
			setSubmitting(false);
		}
	};

	if (step === "consent") {
		return (
			<OnboardingDialog
				title="데이터 활용 동의"
				onClose={() => setStep("phone")}>
				<DataConsentStep disabled={submitting} onAgree={handleConsent} />
			</OnboardingDialog>
		);
	}

	if (step === "role") {
		return (
			<OnboardingDialog
				title="타투이스트 이신가요?"
				onClose={() => setStep("consent")}>
				<RoleAskStep
					disabled={submitting}
					onSelect={(isArtist) => void handleRoleSelect(isArtist)}
				/>
				{submitError && (
					<p role="alert" className="mt-4 text-[13px] leading-5 text-brand">
						{submitError}
					</p>
				)}
			</OnboardingDialog>
		);
	}

	return (
		<div className="flex min-h-[calc(100vh-var(--nav-h))] flex-col items-center justify-center px-6 py-10">
			<SignupPhoneStep
				submitting={false}
				submitError={null}
				onConfirmed={handleConfirmed}
			/>
		</div>
	);
}
