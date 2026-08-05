import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CloseIcon, SearchIcon } from "../community/icons";

/**
 * 타투이스트 검색 바 — 검색어 한 칸으로 도시와 닉네임을 함께 찾는다.
 *
 * 서버에 둘을 한 번에 받는 엔드포인트가 없어 화면에서 두 API를 동시에 부른다
 * (GET /artists?city= · GET /search/artists?q=). 도시는 정확 일치라 닉네임을
 * 넣어도 빈 결과가 와서 오탐이 없다 — 그래서 사용자가 기준을 고르지 않아도 된다.
 */
export default function ArtistSearchBar() {
	const [searchParams, setSearchParams] = useSearchParams();
	// input 값은 로컬 state가 소스 — setSearchParams는 transition이라 값이 늦게
	// 돌아와 한글 IME 조합이 끊기므로(자모 겹침) URL에서 직접 읽지 않는다
	const [value, setValue] = useState(searchParams.get("q") ?? "");

	const update = (next: string) => {
		setValue(next);
		const trimmed = next.trim();
		setSearchParams(trimmed ? { q: trimmed } : {}, { replace: true });
	};

	return (
		<div className="w-full max-w-[520px]">
			<div className="flex h-9 items-center gap-2 rounded-full border border-solid border-black bg-white pl-4 pr-2 shadow-none">
				<SearchIcon size={16} className="shrink-0 text-black" />
				<input
					value={value}
					onChange={(e) => update(e.target.value)}
					placeholder="닉네임 또는 도시로 검색 → 예: 모노라인, 서울"
					maxLength={100}
					aria-label="타투이스트 검색"
					className="min-w-0 flex-1 bg-transparent text-[13px] font-light text-black outline-none placeholder:text-black/35"
				/>
				{value && (
					<button
						type="button"
						aria-label="검색어 지우기"
						onClick={() => update("")}
						className="p-1 text-black">
						<CloseIcon size={14} />
					</button>
				)}
			</div>
		</div>
	);
}
