import { useEffect } from "react";

/** 동시에 열린 모달 개수 — 중첩 모달이 서로의 잠금을 풀지 않도록 참조 카운트로 관리 */
let lockCount = 0;
let previousHtmlOverflow = "";
let previousBodyOverflow = "";
let previousBodyPaddingRight = "";

function lock() {
	if (lockCount++ > 0) return;
	const html = document.documentElement;
	const scrollbarWidth = window.innerWidth - html.clientWidth;
	previousHtmlOverflow = html.style.overflow;
	previousBodyOverflow = document.body.style.overflow;
	previousBodyPaddingRight = document.body.style.paddingRight;
	// 이 앱의 스크롤 컨테이너는 html이라 body에만 걸면 배경이 계속 스크롤된다.
	html.style.overflow = "hidden";
	document.body.style.overflow = "hidden";
	// 스크롤바가 사라지면서 레이아웃이 밀리는 것을 방지
	if (scrollbarWidth > 0) {
		document.body.style.paddingRight = `${scrollbarWidth}px`;
	}
}

function unlock() {
	if (--lockCount > 0) return;
	lockCount = 0;
	document.documentElement.style.overflow = previousHtmlOverflow;
	document.body.style.overflow = previousBodyOverflow;
	document.body.style.paddingRight = previousBodyPaddingRight;
}

/** 모달이 열려 있는 동안 배경 스크롤을 막는다. */
export default function useBodyScrollLock(isLocked: boolean) {
	useEffect(() => {
		if (!isLocked) return;
		lock();
		return unlock;
	}, [isLocked]);
}
