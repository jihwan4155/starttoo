import { useEffect, useState } from "react";

/** 뷰포트가 모바일 폭인지 여부 (기본 768px 이하). AR 플로우 분기에 사용. */
export function useIsMobile(maxWidth = 768): boolean {
	const query = `(max-width: ${maxWidth}px)`;
	const [isMobile, setIsMobile] = useState(() =>
		typeof window !== "undefined" ? window.matchMedia(query).matches : false
	);

	useEffect(() => {
		const mql = window.matchMedia(query);
		const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
		setIsMobile(mql.matches);
		mql.addEventListener("change", handler);
		return () => mql.removeEventListener("change", handler);
	}, [query]);

	return isMobile;
}
