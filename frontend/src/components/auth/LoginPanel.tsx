import { useState } from "react";
import {
	OAUTH_STATE_STORAGE_KEY,
	REAUTH_REQUIRED_STORAGE_KEY,
	kakaoRedirectUri,
} from "../../constants/auth";
import { buildGoogleAuthorizeUrl } from "../../utils/googleOauth";
import { loadKakaoSdk } from "../../utils/kakaoSdk";

/** 카카오 말풍선 심볼 — 디자인 가이드의 심볼을 벡터로 그려 어떤 해상도에서도 선명하다 */
function KakaoIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
			<path
				fill="currentColor"
				d="M12 3.3c-5.08 0-9.2 3.23-9.2 7.21 0 2.57 1.72 4.83 4.31 6.13-.19.7-.69 2.55-.79 2.95-.12.49.18.48.38.35.16-.1 2.5-1.71 3.52-2.4.58.08 1.18.13 1.78.13 5.08 0 9.2-3.23 9.2-7.16S17.08 3.3 12 3.3Z"
			/>
		</svg>
	);
}

/**
 * 구글 G 마크 — 브랜드 가이드의 4색 로고를 벡터로 그린다.
 *
 * 공식 배포 이미지(720×152 PNG)를 쓰면 카카오 버튼과 높이·radius·글자 크기를 맞출 수
 * 없어서, 마크만 규정대로 쓰고 버튼 껍데기는 카카오와 동일한 규격으로 맞춘다.
 */
function GoogleIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
			<path
				fill="#EA4335"
				d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
			/>
			<path
				fill="#4285F4"
				d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"
			/>
			<path
				fill="#FBBC05"
				d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.92 7.54 2.55 10.78l7.98-6.19Z"
			/>
			<path
				fill="#34A853"
				d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.9l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
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

/**
 * 카카오·구글 로그인 버튼 묶음.
 *
 * 페이지(/login)와 모달에서 같은 것을 쓰도록 분리했다. 인가 요청은 두 제공자 모두
 * 현재 탭을 완전히 떠나므로, 모달에서 시작해도 흐름은 페이지와 동일하다.
 */
export default function LoginPanel() {
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
		<div className="w-full">
			{/* 두 버튼은 높이·radius·글자 크기·아이콘 위치를 같은 규격으로 맞춘다.
			    라벨은 가운데, 아이콘은 왼쪽 고정 — 글자 길이가 달라도 정렬이 흔들리지 않는다. */}
			<div className="flex flex-col gap-3">
				<button
					type="button"
					onClick={handleKakaoLogin}
					disabled={disabled}
					className="relative flex h-[56px] w-full items-center justify-center rounded-[12px] border border-transparent bg-[#FEE500] px-14 text-[16px] font-semibold text-black/85 transition hover:brightness-95 disabled:opacity-60">
					<span className="absolute left-5 flex items-center text-black">
						<KakaoIcon />
					</span>
					{pending === "kakao" ? "카카오로 이동 중…" : "카카오 로그인"}
				</button>
				<button
					type="button"
					onClick={handleGoogleLogin}
					disabled={disabled}
					className="relative flex h-[56px] w-full items-center justify-center rounded-[12px] border border-black/[0.12] bg-white px-14 text-[16px] font-semibold text-[#1F1F1F] transition hover:bg-black/[0.03] disabled:opacity-60">
					<span className="absolute left-5 flex items-center">
						<GoogleIcon />
					</span>
					{pending === "google" ? "구글로 이동 중…" : "Google 로그인"}
				</button>
			</div>

			{error && (
				<p
					role="alert"
					className="mt-5 text-center text-[13px] leading-5 text-brand">
					{error}
				</p>
			)}
		</div>
	);
}
