import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import ArtistShopStep from "../components/onboarding/ArtistShopStep";
import type { ArtistShopValues } from "../components/onboarding/ArtistShopStep";
import OnboardingDialog from "../components/onboarding/OnboardingDialog";
import ProfileFormStep from "../components/onboarding/ProfileFormStep";
import type { ProfileFormValues } from "../components/onboarding/ProfileFormStep";
import TastePickStep from "../components/onboarding/TastePickStep";
import { ApiError } from "../services/api";
import { upsertArtistProfile } from "../services/artistApi";
import { submitPreferenceSurvey } from "../services/preferenceApi";
import { updateMe } from "../services/userApi";
import useAuthStore from "../store/useAuthStore";
import useSignupStore from "../store/useSignupStore";
import type { RequestedRole } from "../types/auth";

type Step = "profile" | "shop" | "taste";

const TITLES: Record<Step, string> = {
	profile: "프로필 입력",
	shop: "타투이스트 정보",
	taste: "좋아하는 이미지 고르기",
};

/**
 * 가입 직후 온보딩.
 *
 * 가입과 역할 선택은 앞 화면(/signup)에서 이미 끝나 있다. 여기서 받는 값은 전부
 * 보강이라 어느 단계에서 X로 닫아도 계정은 살아 있고, 그 경우 임시 닉네임 ·
 * 생년월일 없음 상태로 남는다.
 *
 * 프로필 입력은 역할과 무관하게 같고, 타투이스트로 가입한 사람만 그다음에 매장
 * 정보 단계를 한 번 더 거친다.
 */
export default function OnboardingPage() {
	const navigate = useNavigate();
	const accessToken = useAuthStore((s) => s.accessToken);
	// 가입 때 서버 추천으로 배정한 닉네임 — 프로필 입력의 초기값이 된다.
	const assignedNickname = useSignupStore((s) => s.nickname);
	const signupToken = useSignupStore((s) => s.signupToken);
	const clearSignup = useSignupStore((s) => s.clearSignup);

	// 역할은 가입 화면에서 정해져 스토어에 담겨 온다. 여기서는 읽기만 한다.
	const role: RequestedRole = useSignupStore((s) => s.role) ?? "USER";

	const [step, setStep] = useState<Step>("profile");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// 세션 없이 들어오면 온보딩할 대상이 없다.
	if (!accessToken) {
		return <Navigate to="/login" replace />;
	}
	// 온보딩은 가입 직후 한 번뿐이다. 가입 토큰은 온보딩을 마칠 때 clearSignup()으로
	// 지우므로, 세션이 있는데 토큰이 없다는 것은 기존 회원이 로그인한 상태라는 뜻이다.
	// 여기서 막지 않으면 기존 회원이 닉네임·생년월일·성별을 온보딩 값으로 덮어쓰고,
	// 타투이스트라면 전체 덮어쓰기인 숍 정보까지 비워 버린다.
	if (!signupToken) {
		return <Navigate to="/" replace />;
	}

	const finish = () => {
		clearSignup();
		navigate("/", { replace: true });
	};

	const handleProfileSubmit = async (values: ProfileFormValues) => {
		setError(null);
		setSubmitting(true);
		try {
			// nickname은 서버에서 필수라 바꾸지 않았어도 현재 값을 그대로 다시 보낸다.
			// 생년월일·성별은 폼이 채워질 때까지 [다음]을 막으므로 항상 값이 있다.
			await updateMe({
				nickname: values.nickname,
				birthDate: values.birthDate,
				gender: values.gender,
			});
			// 타투이스트만 매장 정보를 한 단계 더 받는다.
			setStep(role === "ARTIST" ? "shop" : "taste");
		} catch (cause) {
			setError(
				cause instanceof ApiError
					? cause.message
					: "프로필을 저장하지 못했습니다.",
			);
		} finally {
			setSubmitting(false);
		}
	};

	const handleShopSubmit = async (values: ArtistShopValues) => {
		setError(null);
		setSubmitting(true);
		// 이 단계는 ARTIST로 가입한 사람만 오므로 role 조건은 통과한다.
		// 그래도 실패를 삼키는 이유는 매장 정보가 선택 입력이기 때문이다 —
		// 비워 두고 넘어갈 수 있는 값 때문에 가입 마지막을 막을 이유가 없다.
		// 못 담았으면 마이페이지에서 다시 채울 수 있다.
		//
		// 이 PATCH는 전체 덮어쓰기라 본문에서 뺀 필드는 NULL이 된다. 가입
		// 직후라 어차피 비어 있으므로 여기서는 아는 두 값만 실어도 안전하다.
		try {
			await upsertArtistProfile({
				...(values.shopName ? { shopName: values.shopName } : {}),
				...(values.shopAddress ? { shopAddress: values.shopAddress } : {}),
			});
		} catch {
			// 선택 입력이라 실패해도 온보딩을 막지 않는다.
		} finally {
			setSubmitting(false);
		}
		setStep("taste");
	};

	const handleTasteSubmit = async (picked: number[]) => {
		const primaryStyleSeqs = [...new Set(picked)];
		// 아무것도 고르지 않았거나(건너뛰기) 분류를 못 받아왔다면 보낼 점수가 없다.
		if (primaryStyleSeqs.length === 0) {
			finish();
			return;
		}

		setError(null);
		setSubmitting(true);
		try {
			// 스타일 이미지에는 색상 정보가 없어 색 취향은 둘러보며 쌓인다.
			await submitPreferenceSurvey({ primaryStyleSeqs });
			finish();
		} catch (cause) {
			setError(
				cause instanceof ApiError
					? cause.message
					: "취향을 저장하지 못했습니다.",
			);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<OnboardingDialog title={TITLES[step]} onClose={finish}>
			{step === "profile" && (
				<ProfileFormStep
					assignedNickname={assignedNickname ?? ""}
					submitting={submitting}
					submitError={error}
					onSubmit={handleProfileSubmit}
				/>
			)}
			{step === "shop" && (
				<ArtistShopStep
					submitting={submitting}
					submitError={error}
					onSubmit={handleShopSubmit}
				/>
			)}
			{step === "taste" && (
				<TastePickStep
					submitting={submitting}
					submitError={error}
					onSubmit={handleTasteSubmit}
				/>
			)}
		</OnboardingDialog>
	);
}
