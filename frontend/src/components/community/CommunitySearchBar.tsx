import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloseIcon, SearchIcon } from "./icons";
import {
	MOCK_CATEGORIES,
	MOCK_RECENT_SEARCHES,
	MOCK_SUGGESTIONS,
} from "../../mocks/community";

/** 커뮤니티 상단 검색 바 (추천 카테고리 · 최근 검색어 · 자동완성) */
export default function CommunitySearchBar() {
	const navigate = useNavigate();
	const [value, setValue] = useState("");
	const [isFocused, setFocused] = useState(false);
	// TODO: 최근 검색어 API(/users/me/recent-searches) 연동
	const [recentSearches, setRecentSearches] = useState(MOCK_RECENT_SEARCHES);

	const suggestions = value.trim()
		? MOCK_SUGGESTIONS.filter((s) =>
				s.toLowerCase().includes(value.trim().toLowerCase()),
			)
		: [];

	const submit = (term: string) => {
		const keyword = term.trim();
		if (!keyword) return;
		setRecentSearches((prev) => [
			keyword,
			...prev.filter((item) => item !== keyword),
		]);
		setValue("");
		setFocused(false);
		navigate(`/posts/search?q=${encodeURIComponent(keyword)}`);
	};

	return (
		<div className="relative w-full max-w-[520px]">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					submit(value);
				}}
				className="flex h-9 items-center gap-2 rounded-full bg-white pl-4 pr-3 shadow-sm">
				<SearchIcon size={16} className="shrink-0 text-black/40" />
				<input
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onFocus={() => setFocused(true)}
					onBlur={() => setFocused(false)}
					placeholder="도안, 아티스트 등을 검색해보세요"
					className="min-w-0 flex-1 bg-transparent text-[13px] font-light text-black outline-none placeholder:text-black/35"
				/>
				{value && (
					<button
						type="button"
						aria-label="검색어 지우기"
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => setValue("")}
						className="text-black/40 transition hover:text-black">
						<CloseIcon size={14} />
					</button>
				)}
			</form>

			{isFocused && (
				<div
					className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 rounded-[14px] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.15)]"
					// input blur보다 먼저 실행돼 클릭이 무시되지 않도록 방지
					onMouseDown={(e) => e.preventDefault()}>
					{suggestions.length > 0 ? (
						<ul>
							{suggestions.map((suggestion) => (
								<li key={suggestion}>
									<button
										type="button"
										onClick={() => submit(suggestion)}
										className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[13px] font-light text-black transition hover:bg-black/5">
										<SearchIcon size={14} className="text-black/35" />
										{suggestion}
									</button>
								</li>
							))}
						</ul>
					) : (
						<>
							<p className="text-[13px] font-semibold text-black">
								추천 카테고리
							</p>
							<div className="mt-2.5 flex flex-wrap gap-2">
								{MOCK_CATEGORIES.map((category) => (
									<button
										key={category}
										type="button"
										onClick={() => submit(category)}
										className="rounded-full bg-brand px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:brightness-95">
										{category}
									</button>
								))}
							</div>

							<p className="mt-5 text-[13px] font-semibold text-black">
								최근 검색어
							</p>
							{recentSearches.length > 0 ? (
								<ul className="mt-1.5">
									{recentSearches.map((keyword) => (
										<li
											key={keyword}
											className="flex items-center justify-between">
											<button
												type="button"
												onClick={() => submit(keyword)}
												className="flex-1 rounded-lg px-2 py-2 text-left text-[13px] font-light text-black transition hover:bg-black/5">
												{keyword}
											</button>
											<button
												type="button"
												aria-label={`${keyword} 삭제`}
												onClick={() =>
													setRecentSearches((prev) =>
														prev.filter((item) => item !== keyword),
													)
												}
												className="p-1.5 text-black/35 transition hover:text-black">
												<CloseIcon size={13} />
											</button>
										</li>
									))}
								</ul>
							) : (
								<p className="mt-2 px-2 text-[13px] font-light text-black/40">
									최근 검색어가 없어요.
								</p>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}
