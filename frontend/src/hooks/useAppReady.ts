import { useEffect, useRef, useState } from "react";

type Options = {
	/** 로딩 화면을 최소 이만큼은 보여줍니다 (깜빡임 방지) */
	minMs?: number;
	/** 폰트까지 다 뜬 뒤에 넘길지 */
	waitForFonts?: boolean;
};

/**
 * 실제 페이지 로딩 + 최소 노출 시간을 함께 지키는 훅.
 * progress는 눈속임이지만, 끝나는 시점만은 진짜 load 이벤트에 맞춰집니다.
 */
export function useAppReady({ minMs = 900, waitForFonts = true }: Options = {}) {
	const [progress, setProgress] = useState(0);
	const [ready, setReady] = useState(false);
	const loadedRef = useRef(false);

	// 진행률: 로드 전까지 90%까지만 기어오릅니다
	useEffect(() => {
		const id = window.setInterval(() => {
			setProgress((p) => {
				if (loadedRef.current) return Math.min(100, p + 12);
				return Math.min(90, p + Math.random() * 7);
			});
		}, 180);
		return () => window.clearInterval(id);
	}, []);

	useEffect(() => {
		const startedAt = Date.now();
		let timer = 0;

		const finish = () => {
			loadedRef.current = true;
			const wait = Math.max(0, minMs - (Date.now() - startedAt));
			timer = window.setTimeout(() => setReady(true), wait);
		};

		const onLoad = () => {
			const fonts =
				waitForFonts && "fonts" in document
					? document.fonts.ready
					: Promise.resolve();
			void fonts.then(finish);
		};

		// React가 load 이후에 마운트되는 경우도 있습니다
		if (document.readyState === "complete") onLoad();
		else window.addEventListener("load", onLoad);

		return () => {
			window.removeEventListener("load", onLoad);
			window.clearTimeout(timer);
		};
	}, [minMs, waitForFonts]);

	return { progress, ready };
}
