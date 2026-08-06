import { useEffect, useRef } from "react";

type Entry = { key: string; close: () => void };

// 열려 있는 오버레이 목록. 뒤로가기 한 번은 항상 가장 위 오버레이 하나만 닫는다.
const stack: Entry[] = [];
let seq = 0;

const handlePopState = () => {
	stack.pop()?.close();
};

/**
 * 오버레이가 열려 있는 동안 히스토리 항목을 하나 밀어 넣어, 뒤로가기가 페이지를
 * 떠나는 대신 오버레이만 닫게 한다. 여러 개가 겹쳐 있으면 위에서부터 하나씩 닫힌다.
 *
 * 한계: 오버레이 안의 링크를 눌러 다른 화면으로 이동하면 우리가 밀어 넣은 항목이
 * 히스토리에 남는다. 주소가 아래 항목과 같아서 화면은 그대로지만, 그만큼 뒤로가기가
 * 한 번 더 필요하다. 남은 항목을 자동으로 건너뛰면 앞으로가기가 망가지므로 두지 않는다.
 *
 * @param isOpen 오버레이가 열려 있는지
 * @param onClose 뒤로가기로 닫을 때 부를 함수
 */
export default function useBackClose(isOpen: boolean, onClose: () => void) {
	// onClose가 매 렌더 새 함수여도 effect가 다시 돌지 않게 ref로 읽는다
	const closeRef = useRef(onClose);
	closeRef.current = onClose;

	useEffect(() => {
		if (!isOpen) return;

		const key = `overlay-${++seq}`;
		const entry: Entry = { key, close: () => closeRef.current() };
		stack.push(entry);
		if (stack.length === 1) {
			window.addEventListener("popstate", handlePopState);
		}
		window.history.pushState({ ...window.history.state, overlay: key }, "");

		return () => {
			// 뒤로가기로 닫혔으면 handlePopState가 이미 꺼내 갔다
			const at = stack.indexOf(entry);
			const byBack = at === -1;
			if (!byBack) stack.splice(at, 1);
			if (stack.length === 0) {
				window.removeEventListener("popstate", handlePopState);
			}

			// 버튼·배경 클릭으로 닫혔고 그 사이 다른 화면으로 이동하지도 않았다면,
			// 우리가 밀어 넣은 항목을 직접 걷어낸다. 링크를 눌러 닫힌 경우에는
			// history.state가 라우터 것으로 바뀌어 있어 이동을 되돌리지 않는다.
			if (!byBack && window.history.state?.overlay === key) {
				window.history.back();
			}
		};
	}, [isOpen]);
}
