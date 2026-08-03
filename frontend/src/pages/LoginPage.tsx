import { useState } from "react";
import googleLoginBtn from "../assets/images/auth/google-login-btn.png";
import {
	OAUTH_STATE_STORAGE_KEY,
	REAUTH_REQUIRED_STORAGE_KEY,
	kakaoRedirectUri,
} from "../constants/auth";
import { buildGoogleAuthorizeUrl } from "../utils/googleOauth";
import { loadKakaoSdk } from "../utils/kakaoSdk";

/** 카카오 말풍선 심볼 — 디자인 가이드의 심볼을 벡터로 그려 어떤 해상도에서도 선명하다 */
function KakaoIcon() {
	return (
		<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
			<path
				fill="currentColor"
				d="M12 3.3c-5.08 0-9.2 3.23-9.2 7.21 0 2.57 1.72 4.83 4.31 6.13-.19.7-.69 2.55-.79 2.95-.12.49.18.48.38.35.16-.1 2.5-1.71 3.52-2.4.58.08 1.18.13 1.78.13 5.08 0 9.2-3.23 9.2-7.16S17.08 3.3 12 3.3Z"
			/>
		</svg>
	);
}

/**
 * 직접 로그아웃한 뒤인지 — 인가 요청에 재인증 프롬프트를 붙일지 결정한다.
 *
 * 카카오·구글 모두 우리 로그아웃으로는 브라우저에 남은 계정 세션이 끊기지 않아,
 * 프롬프트 없이 요청하면 같은 계정으로 조용히 통과된다. 표시를 지우는 것은 로그인이
 * 실제로 성공한 시점(useAuthStore.setSession)이다 — 인가 화면에서 취소하고 돌아온
 * 경우에는 다음 시도에도 프롬프트가 남아 있어야 한다.
 */
function needsReauth(): boolean {
	return localStorage.getItem(REAUTH_REQUIRED_STORAGE_KEY) !== null;
}

/** 인가 화면으로 이동 중인 제공자 — 버튼별 라벨을 구분하기 위해 boolean이 아니다 */
type PendingProvider = "kakao" | "google" | null;

export default function LoginPage() {
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState<PendingProvider>(null);
	// 리다이렉트 중 다른 제공자로 중복 요청하는 것을 막는다.
	const disabled = pending !== null;

	const handleKakaoLogin = async () => {
		setError(null);
		setPending("kakao");
		try {
			const kakao = await loadKakaoSdk();
			// 콜백에서 대조할 임의 state — 인가 요청과 응답이 같은 세션인지 확인한다.
			const state = crypto.randomUUID();
			sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state);
			// 로그아웃 뒤라면 prompt=login — 브라우저에 카카오계정 세션이 남아 있어도
			// 로그인 화면을 다시 띄워 아이디·비밀번호를 새로 받는다.
			const reauth = needsReauth();
			// authorize()는 카카오 동의 화면으로 이동시키고, 끝나면 redirectUri로
			// ?code=... 를 붙여 돌아온다. 브라우저에 액세스 토큰은 오지 않는다.
			kakao.Auth.authorize({
				redirectUri: kakaoRedirectUri(),
				state,
				...(reauth ? { prompt: "login" as const } : {}),
			});
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "카카오 로그인을 시작하지 못했습니다.",
			);
			setPending(null);
		}
	};

	const handleGoogleLogin = () => {
		setError(null);
		setPending("google");
		try {
			// 콜백에서 대조할 임의 state — 인가 요청과 응답이 같은 세션인지 확인한다.
			const state = crypto.randomUUID();
			sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state);
			// 로그아웃 뒤라면 prompt=select_account — 구글은 카카오의 login에 해당하는
			// 값이 없어(none·consent·select_account만) 비밀번호 재입력까지는 강제할 수
			// 없다. 대신 계정 선택 화면을 반드시 거치게 해서 같은 계정으로 조용히 다시
			// 로그인되는 것을 막는다.
			// 구글 동의 화면으로 이동. 끝나면 redirectUri로 ?code=... 를 붙여 돌아온다.
			window.location.assign(
				buildGoogleAuthorizeUrl(
					state,
					needsReauth() ? "select_account" : undefined,
				),
			);
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "구글 로그인을 시작하지 못했습니다.",
			);
			setPending(null);
		}
	};

	return (
		<div className="flex min-h-[calc(100vh-60px)] flex-col items-center justify-center px-6">
			<h1 className="text-[28px] font-extrabold text-black">로그인</h1>
			<p className="mt-2 text-[14px] font-light text-black/60">
				상상만 하던 타투, 이제 눈으로 확인해보세요
			</p>

			<div className="mt-10 flex w-full max-w-[320px] flex-col gap-3">
				{/* 카카오 버튼 — 디자인 가이드 색상(#FEE500, 검정 85% 라벨)대로 CSS로 그린다.
				    저해상도 이미지와 달리 어떤 크기에서도 선명하다.
				    aspect-[720/160]은 구글 공식 이미지와 같은 비율 — 두 버튼 크기를 맞춘다. */}
				<button
					type="button"
					onClick={handleKakaoLogin}
					disabled={disabled}
					className="relative flex aspect-[720/160] w-full items-center justify-center rounded-[12px] bg-[#FEE500] px-14 text-[17px] font-semibold text-black/85 transition hover:brightness-95 disabled:opacity-60">
					<span className="absolute left-6 flex items-center text-black">
						<KakaoIcon />
					</span>
					{pending === "kakao" ? "카카오로 이동 중…" : "카카오 로그인"}
				</button>
				{/* 구글 버튼 — 브랜드 가이드가 엄격해 공식 이미지(720×152 원본)를 그대로 쓴다 */}
				<button
					type="button"
					onClick={handleGoogleLogin}
					disabled={disabled}
					className="w-full transition hover:brightness-95 disabled:opacity-60">
					<img
						src={googleLoginBtn}
						alt="Google로 로그인"
						className="block h-auto w-full rounded-[12px]"
					/>
				</button>
			</div>

			{error && (
				<p
					role="alert"
					className="mt-5 max-w-[320px] text-center text-[13px] leading-5 text-brand">
					{error}
				</p>
			)}
		</div>
	);
}
