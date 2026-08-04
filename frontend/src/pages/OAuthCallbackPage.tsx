import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
	OAUTH_STATE_STORAGE_KEY,
	POST_LOGIN_REDIRECT_STORAGE_KEY,
	googleRedirectUri,
	kakaoRedirectUri,
	safePostLoginRedirect,
} from "../constants/auth";
import StarttooLoader from "../components/loader/StarttooLoader";
import { socialLogin } from "../services/authApi";
import { ApiError } from "../services/api";
import useAuthStore from "../store/useAuthStore";
import useSignupStore from "../store/useSignupStore";
import type { SocialProvider } from "../types/auth";

const PROVIDER_META: Record<
	SocialProvider,
	{ label: string; redirectUri: () => string }
> = {
	KAKAO: { label: "카카오", redirectUri: kakaoRedirectUri },
	GOOGLE: { label: "구글", redirectUri: googleRedirectUri },
};

/**
 * 제공자(카카오/구글) 동의 화면에서 돌아오는 지점.
 *
 * 받은 authorization code를 백엔드로 넘겨(서버가 제공자와 토큰을 교환한다)
 * 기존 회원이면 세션을 세우고 홈으로, 미가입이면 가입 토큰을 들고 가입 플로우로 보낸다.
 * 두 제공자 모두 표준 authorization code 흐름이라 처리 로직이 같다.
 */
export default function OAuthCallbackPage({
	provider,
}: {
	provider: SocialProvider;
}) {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const setSession = useAuthStore((s) => s.setSession);
	const setSignupToken = useSignupStore((s) => s.setSignupToken);
	const clearSignup = useSignupStore((s) => s.clearSignup);
	const [error, setError] = useState<string | null>(null);
	// 인가 코드는 1회용이라 재실행되면 두 번째 교환이 반드시 실패한다.
	const exchanged = useRef(false);

	useEffect(() => {
		if (exchanged.current) return;

		const { label, redirectUri } = PROVIDER_META[provider];

		// 인가 코드를 읽은 뒤 주소창에서 지운다. 1회용이라 유출돼도 쓸 수 없지만
		// 히스토리·Referer에 남기지 않는 편이 낫다. (실패해도 이 화면에 머무르므로 필요)
		const clearQuery = () =>
			window.history.replaceState({}, "", window.location.pathname);

		const denied = searchParams.get("error");
		if (denied) {
			// 사용자가 동의 화면에서 취소한 경우도 여기로 온다.
			setError(
				searchParams.get("error_description") ??
					`${label} 인증이 취소되었습니다.`,
			);
			clearQuery();
			return;
		}

		const code = searchParams.get("code");
		if (!code) {
			setError("인가 코드가 전달되지 않았습니다.");
			return;
		}

		// 인가 요청 때 저장해 둔 state와 대조 (CSRF 방지). 확인 후 즉시 제거한다.
		const expected = sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY);
		sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
		if (expected && searchParams.get("state") !== expected) {
			setError("state 값이 일치하지 않습니다. 로그인을 다시 시도해주세요.");
			clearQuery();
			return;
		}

		exchanged.current = true;
		clearQuery();
		socialLogin({
			provider,
			authorizationCode: code,
			// 인가 때 쓴 값과 같아야 서버의 토큰 교환이 통과한다.
			redirectUri: redirectUri(),
		})
			.then((result) => {
				if (result.signupRequired) {
					if (!result.signupToken) {
						setError("가입 토큰이 전달되지 않았습니다.");
						return;
					}
					// 중단한 가입이 남긴 번호·닉네임이 새 가입에 섞이지 않게 먼저 비운다.
					clearSignup();
					setSignupToken(result.signupToken);
					navigate("/signup", { replace: true });
					return;
				}
				if (!result.tokens) {
					setError("로그인 토큰이 전달되지 않았습니다.");
					return;
				}
				setSession({
					accessToken: result.tokens.accessToken,
					refreshToken: result.tokens.refreshToken,
				});
				// 기존 회원으로 들어왔으니 중단된 가입 재료는 쓸 데가 없다. 남겨 두면
				// 이 탭에서 /signup에 닿았을 때 그 가입이 조용히 이어진다.
				clearSignup();
				// 로그인 필요 페이지에서 튕겨져 왔다면 원래 가려던 곳으로 돌려보낸다.
				// 가입·온보딩 화면이 목적지로 남아 있으면 버리고 홈으로 간다.
				const redirect = safePostLoginRedirect(
					sessionStorage.getItem(POST_LOGIN_REDIRECT_STORAGE_KEY),
				);
				sessionStorage.removeItem(POST_LOGIN_REDIRECT_STORAGE_KEY);
				navigate(redirect ?? "/", { replace: true });
			})
			.catch((cause: unknown) => {
				setError(
					cause instanceof ApiError
						? cause.message
						: "로그인 처리 중 문제가 발생했습니다.",
				);
			});
	}, [
		provider,
		searchParams,
		navigate,
		setSession,
		setSignupToken,
		clearSignup,
	]);

	return (
		<div className="flex min-h-[calc(100vh-60px)] flex-col items-center justify-center gap-4 px-6 text-center">
			{error === null ? (
				<StarttooLoader variant="block" label="로그인 중…" />
			) : (
				<>
					<h1 className="text-[20px] font-bold text-black">
						로그인하지 못했습니다
					</h1>
					<p
						role="alert"
						className="max-w-[420px] text-[13px] leading-5 text-brand">
						{error}
					</p>
					<Link
						to="/login"
						className="mt-2 text-[14px] font-semibold text-black/50 underline">
						로그인 화면으로
					</Link>
				</>
			)}
		</div>
	);
}
