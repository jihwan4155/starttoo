/**
 * 목록 자리를 미리 잡아 주는 회색 뼈대.
 *
 * 스피너는 "무언가 돌고 있다"만 알려 주고 화면은 계속 비어 있다. 뼈대는 결과가
 * 어떤 모양으로 채워질지 미리 보여 줘서 같은 시간이 덜 걸리는 것처럼 느껴진다.
 * 실제 카드·타일과 같은 비율·간격을 써야 내용이 도착할 때 화면이 튀지 않는다.
 */

const BLOCK = "animate-pulse rounded bg-black/10";

/** 커뮤니티 피드 카드 한 장 — PostCard와 같은 세로 구성 */
function PostCardSkeleton() {
	return (
		<div className="w-full overflow-hidden rounded-[12px] bg-white pb-4 lg:rounded-none lg:bg-transparent lg:pb-0">
			<div className="flex items-center gap-3 px-3 py-3 lg:px-0 lg:py-0">
				<div className={`size-9 shrink-0 rounded-full ${BLOCK}`} />
				<div className={`h-3 w-24 ${BLOCK}`} />
			</div>
			<div className={`mt-3 aspect-square w-full lg:rounded-[8px] ${BLOCK}`} />
			<div className="mt-3 flex gap-4 px-3 lg:px-0">
				<div className={`h-5 w-10 ${BLOCK}`} />
				<div className={`h-5 w-10 ${BLOCK}`} />
				<div className={`h-5 w-5 ${BLOCK}`} />
			</div>
			<div className={`mt-3 h-3 w-3/4 px-3 lg:px-0 ${BLOCK}`} />
		</div>
	);
}

export function PostFeedSkeleton({ count = 2 }: { count?: number }) {
	return (
		<div className="flex flex-col gap-6" aria-hidden>
			{Array.from({ length: count }, (_, i) => (
				<PostCardSkeleton key={i} />
			))}
		</div>
	);
}

/** 검색·탐색 그리드 — CommunitySearchPage의 3열·4열 타일과 같은 비율 */
export function PostGridSkeleton({ count = 12 }: { count?: number }) {
	return (
		<div
			className="grid grid-cols-3 gap-0.5 lg:grid-cols-4 lg:gap-3"
			aria-hidden>
			{Array.from({ length: count }, (_, i) => (
				<div
					key={i}
					className={`aspect-[3/4] lg:rounded-[6px] ${BLOCK}`}
				/>
			))}
		</div>
	);
}
