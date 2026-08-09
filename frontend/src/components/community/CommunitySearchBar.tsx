import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CloseIcon, SearchIcon } from "./icons";
import useRecentSearches from "../../hooks/queries/useRecentSearches";
import { recentSearchesQueryKey } from "../../hooks/queries/useRecentSearches";
import useSubjectAutocomplete from "../../hooks/queries/useSubjectAutocomplete";
import { deleteRecentSearch, saveRecentSearch } from "../../services/userApi";
import { PRIMARY_STYLE_CATEGORIES } from "../../constants/community";
import useAuthStore from "../../store/useAuthStore";
import { notifyActionError } from "../../utils/actionError";

type CommunitySearchBarProps = {
	/**
	 * 가로를 꽉 채운다. 기본값은 상단 바에 맞춘 520px 상한인데, 검색 화면처럼
	 * 검색이 주인공인 자리에서는 그 상한이 오히려 어색하게 남는다.
	 */
	fullWidth?: boolean;
};

/** 커뮤니티 상단 검색 바 */
export default function CommunitySearchBar({
	fullWidth = false,
}: CommunitySearchBarProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [value, setValue] = useState("");
	const [isFocused, setFocused] = useState(false);
	const accessToken = useAuthStore((s) => s.accessToken);
	const { data: recentItems = [] } = useRecentSearches();

	// 입력 중에는 서버 subject 사전에서 추천어를 받는다 (GET /search/subjects/autocomplete).
	// 피드 검색이 subject 기반이라, 사전에 있는 말로 검색해야 결과가 나온다.
	const { data: subjectSuggestions = [] } = useSubjectAutocomplete(value);
	const suggestions = value.trim()
		? subjectSuggestions.map((subject) => subject.subjectName)
		: [];

	const persistSearch = async (keyword: string) => {
		if (!accessToken) return;
		try {
			await saveRecentSearch(keyword);
			await queryClient.invalidateQueries({ queryKey: recentSearchesQueryKey });
		} catch {
			// 최근 검색어 저장 실패는 검색 자체를 막지 않음
		}
	};

	const submit = (term: string) => {
		const keyword = term.trim();
		if (!keyword) return;
		void persistSearch(keyword);
		setValue("");
		setFocused(false);
		navigate(`/posts/search?q=${encodeURIComponent(keyword)}`);
	};

	const submitPrimaryCategory = (primaryStyle: string) => {
		setValue("");
		setFocused(false);
		navigate(`/posts/search?primary=${encodeURIComponent(primaryStyle)}`);
	};

	const handleDeleteRecent = async (keyword: string) => {
		try {
			await deleteRecentSearch(keyword);
			await queryClient.invalidateQueries({ queryKey: recentSearchesQueryKey });
		} catch (err) {
			notifyActionError(err, "최근 검색어 삭제에 실패했습니다.");
		}
	};

	return (
		<div className={`relative w-full ${fullWidth ? "" : "max-w-[520px]"}`}>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					submit(value);
				}}
				/* 생김새는 피드의 회원 검색 바와 같다 — 검은 테두리 대신 그림자로 띄운다 */
				className="flex h-10 items-center gap-2 rounded-full bg-white pl-4 pr-2 shadow-sm">
				<SearchIcon size={16} className="shrink-0 text-black/40" />
				<input
					value={value}
					onChange={(e) => {
						setValue(e.target.value);
						// 검색해도 포커스는 입력창에 그대로 남아 있어 onFocus가 다시 오지
						// 않는다. 그래서 검색 직후 이어서 타이핑하면 추천어 창이 닫힌 채였다.
						// 입력이 있으면 여기서 직접 펼친다.
						setFocused(true);
					}}
					// 이미 포커스된 입력창을 다시 눌러도 onFocus는 오지 않는다
					onClick={() => setFocused(true)}
					onFocus={() => setFocused(true)}
					onBlur={() => setFocused(false)}
					placeholder="게시물 검색 → 예: 나비, 장미"
					maxLength={50}
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
					onMouseDown={(e) => e.preventDefault()}>
					{suggestions.length > 0 ? (
						<ul>
							{suggestions.map((suggestion) => (
								<li key={suggestion}>
									<button
										type="button"
										onClick={() => submit(suggestion)}
										className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[13px] font-light text-black transition hover:bg-black/5">
										<SearchIcon size={14} className="text-black" />
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
							<div className="mt-2.5 overflow-x-auto pb-1">
								<div className="flex w-max flex-nowrap gap-2">
									{PRIMARY_STYLE_CATEGORIES.map((category) => (
										<button
											key={category.code}
											type="button"
											onClick={() => submitPrimaryCategory(category.code)}
											className="shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:brightness-95">
											{category.label}
										</button>
									))}
								</div>
							</div>

							<p className="mt-5 text-[13px] font-semibold text-black">
								최근 검색어
							</p>
							{accessToken && recentItems.length > 0 ? (
								<ul className="mt-1.5">
									{recentItems.map((keyword) => (
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
												onClick={() => void handleDeleteRecent(keyword)}
												className="p-1.5 text-black/35 transition hover:text-black">
												<CloseIcon size={13} />
											</button>
										</li>
									))}
								</ul>
							) : (
								<p className="mt-2 px-2 text-[13px] font-light text-black/40">
									{accessToken
										? "최근 검색어가 없어요."
										: "로그인하면 최근 검색어가 저장됩니다."}
								</p>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}
