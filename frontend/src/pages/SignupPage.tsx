import { Link, Navigate } from "react-router-dom";
import useSignupStore from "../store/useSignupStore";

/**
 * 회원가입 플로우 진입점.
 *
 * 현재는 가입 토큰을 받아왔는지만 확인한다.
 * 전화번호 확인 → 닉네임 → 역할 선택 화면은 다음 단계에서 붙인다.
 */
export default function SignupPage() {
	const signupToken = useSignupStore((s) => s.signupToken);

	// 토큰 없이 직접 들어온 경우 — 소셜 로그인부터 다시.
	if (!signupToken) {
		return <Navigate to="/login" replace />;
	}

	return (
		<div className="flex min-h-[calc(100vh-60px)] flex-col items-center justify-center gap-4 px-6 text-center">
			<p className="text-[14px] font-light text-black/60">
				스타트투가 처음이시네요
			</p>
			<h1 className="text-[24px] font-extrabold text-black">회원가입</h1>
			<p className="max-w-[420px] text-[13px] leading-5 text-black/55">
				가입 토큰을 받았습니다. 전화번호 확인·닉네임·역할 선택 화면은 다음
				단계에서 이어집니다.
			</p>
			<Link
				to="/login"
				className="mt-2 text-[14px] font-semibold text-black/50 underline">
				로그인 화면으로
			</Link>
		</div>
	);
}
