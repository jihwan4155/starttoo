import type { ReactNode } from "react";
import StarttooLoader from "./StarttooLoader";

/**
 * 버튼 안 대기 상태 라벨 — 브랜드 로더를 글자 앞에 붙인다.
 *
 * <p>누르고 기다리는 버튼은 문구만 "저장 중…"으로 바뀌면 눌린 것인지 멈춘 것인지
 * 구분되지 않는다. 회전하는 마크가 앞에 있어야 진행 중이라는 게 보인다.
 *
 * <p>delayMs=0인 것은 의도다. StarttooLoader의 기본 지연(300ms)은 캐시된 응답에
 * 로더가 번쩍이는 것을 막는 값인데, 버튼은 이미 문구가 바뀌어 있어서 로더만 늦게
 * 나타나면 오히려 깨져 보인다.
 *
 * <p>mark 변형은 inline-grid라 text-align만 쓰는 버튼에도 그대로 얹힌다. 다만
 * 세로 정렬을 정확히 맞추려면 버튼에 inline-flex items-center를 주는 편이 낫다.
 */
export default function LoadingLabel({ children }: { children: ReactNode }) {
	return (
		<>
			<StarttooLoader variant="mark" label={null} delayMs={0} />
			<span className="ml-1.5">{children}</span>
		</>
	);
}
