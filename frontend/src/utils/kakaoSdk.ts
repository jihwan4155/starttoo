/**
 * 카카오 JavaScript SDK 로더.
 *
 * 카카오 웹 SDK는 브라우저에 액세스 토큰을 주지 않는다. `authorize()`는 동의 화면을 거쳐
 * redirectUri로 authorization code만 돌려주고, 코드를 토큰으로 바꾸는 일은 REST API 키가
 * 필요해 서버가 맡는다. 그래서 프론트는 code를 확보해 백엔드로 넘기는 역할만 한다.
 */

const SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.5/kakao.min.js";
const SDK_INTEGRITY =
	"sha384-dok87au0gKqJdxs7msEdBPNnKSRT+/mhTVzq+qOhcL464zXwvcrpjeWvyj1kCdq6";

type KakaoAuthorizeParams = {
	redirectUri: string;
	/** 콜백에서 되돌려받을 임의 문자열 — CSRF 방지용 */
	state?: string;
	scope?: string;
};

type KakaoSdk = {
	init: (jsKey: string) => void;
	isInitialized: () => boolean;
	Auth: {
		authorize: (params: KakaoAuthorizeParams) => void;
	};
};

declare global {
	interface Window {
		Kakao?: KakaoSdk;
	}
}

let loadPromise: Promise<KakaoSdk> | null = null;

function injectScript(): Promise<void> {
	return new Promise((resolve, reject) => {
		const existing = document.querySelector<HTMLScriptElement>(
			`script[src="${SDK_SRC}"]`,
		);
		if (existing) {
			if (window.Kakao) {
				resolve();
				return;
			}
			existing.addEventListener("load", () => resolve(), { once: true });
			existing.addEventListener(
				"error",
				() => reject(new Error("카카오 SDK를 불러오지 못했습니다.")),
				{ once: true },
			);
			return;
		}

		const script = document.createElement("script");
		script.src = SDK_SRC;
		script.integrity = SDK_INTEGRITY;
		script.crossOrigin = "anonymous";
		script.async = true;
		script.addEventListener("load", () => resolve(), { once: true });
		script.addEventListener(
			"error",
			() => reject(new Error("카카오 SDK를 불러오지 못했습니다.")),
			{ once: true },
		);
		document.head.appendChild(script);
	});
}

/** SDK를 한 번만 내려받고 JavaScript 키로 초기화한다. */
export function loadKakaoSdk(): Promise<KakaoSdk> {
	if (loadPromise) return loadPromise;

	const jsKey = import.meta.env.VITE_KAKAO_JS_KEY;
	if (!jsKey) {
		return Promise.reject(
			new Error(
				"VITE_KAKAO_JS_KEY가 설정되지 않았습니다. .env.local에 카카오 JavaScript 앱 키를 넣어주세요.",
			),
		);
	}

	loadPromise = injectScript()
		.then(() => {
			const kakao = window.Kakao;
			if (!kakao) {
				throw new Error("카카오 SDK 초기화에 실패했습니다.");
			}
			if (!kakao.isInitialized()) {
				kakao.init(jsKey);
			}
			return kakao;
		})
		.catch((error: unknown) => {
			// 실패한 시도를 캐시하지 않아야 다음 클릭에서 재시도된다.
			loadPromise = null;
			throw error;
		});

	return loadPromise;
}
