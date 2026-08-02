import { useState } from "react";
import googleLoginBtn from "../assets/images/auth/google-login-btn.png";
import {
	OAUTH_STATE_STORAGE_KEY,
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

export default function LoginPage() {
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const handleKakaoLogin = async () => {
		setError(null);
		setLoading(true);
		try {
			const kakao = await loadKakaoSdk();
			// 콜백에서 대조할 임의 state — 인가 요청과 응답이 같은 세션인지 확인한다.
			const state = crypto.randomUUID();
			sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state);
			// authorize()는 카카오 동의 화면으로 이동시키고, 끝나면 redirectUri로
			// ?code=... 를 붙여 돌아온다. 브라우저에 액세스 토큰은 오지 않는다.
			kakao.Auth.authorize({ redirectUri: kakaoRedirectUri(), state });
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "카카오 로그인을 시작하지 못했습니다.",
			);
			setLoading(false);
		}
	};

	const handleGoogleLogin = () => {
		setError(null);
		setLoading(true);
		try {
			// 콜백에서 대조할 임의 state — 인가 요청과 응답이 같은 세션인지 확인한다.
			const state = crypto.randomUUID();
			sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state);
			// 구글 동의 화면으로 이동. 끝나면 redirectUri로 ?code=... 를 붙여 돌아온다.
			window.location.assign(buildGoogleAuthorizeUrl(state));
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "구글 로그인을 시작하지 못했습니다.",
			);
			setLoading(false);
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
					disabled={loading}
					className="relative flex aspect-[720/160] w-full items-center justify-center rounded-[12px] bg-[#FEE500] px-14 text-[17px] font-semibold text-black/85 transition hover:brightness-95 disabled:opacity-60">
					<span className="absolute left-6 flex items-center text-black">
						<KakaoIcon />
					</span>
					{loading ? "카카오로 이동 중…" : "카카오 로그인"}
				</button>
				{/* 구글 버튼 — 브랜드 가이드가 엄격해 공식 이미지(720×152 원본)를 그대로 쓴다 */}
				<button
					type="button"
					onClick={handleGoogleLogin}
					disabled={loading}
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
