import { useState } from "react";
import { Link } from "react-router-dom";
import { CloseIcon, SearchIcon } from "./icons";
import StarttooLoader from "../loader/StarttooLoader";
import useAccountSearch from "../../hooks/queries/useAccountSearch";
import { ApiError } from "../../services/api";
import { isSearchableQuery } from "../../types/search";
import { profilePath, resolveAvatar } from "../../utils/profile";

/**
 * 커뮤니티 우측 유저 검색 패널 — 모든 회원을 닉네임으로 찾는다.
 *
 * GET /search/accounts (한 글자는 자동완성)를 쓴다. 응답 AccountResult에는
 * 프로필 이미지가 없어 닉네임 기반 기본 아바타를 띄운다.
 *
 * 인증 뱃지는 붙이지 않는다 — AccountResult에 verificationStatus가 없어서
 * role만으로 판단하면 심사 전 계정에도 뱃지가 붙는다. (isVerifiedArtist 참고)
 */
export default function UserSearchPanel() {
	const [value, setValue] = useState("");
	const trimmed = value.trim();
	const { data, isFetching, isError, error } = useAccountSearch(trimmed);

	const hasInvalidChars = trimmed.length > 0 && !isSearchableQuery(trimmed);
	const results = data ?? [];
	const errorMessage =
		error instanceof ApiError ? error.message : "검색에 실패했습니다.";

	return (
		<aside className="w-full">
			<h2 className="px-1 text-[14px] font-bold text-black">회원 검색</h2>

			<div className="mt-3 flex h-10 items-center gap-2 rounded-full bg-white pl-4 pr-2 shadow-sm">
				<SearchIcon size={16} className="shrink-0 text-black/40" />
				<input
					value={value}
					onChange={(e) => setValue(e.target.value)}
					placeholder="닉네임으로 검색"
					maxLength={20}
					aria-label="회원 닉네임 검색"
					className="min-w-0 flex-1 bg-transparent text-[13px] font-light text-black outline-none placeholder:text-black/35"
				/>
				{value && (
					<button
						type="button"
						aria-label="검색어 지우기"
						onClick={() => setValue("")}
						className="p-1 text-black/40 transition hover:text-black">
						<CloseIcon size={14} />
					</button>
				)}
			</div>

			{hasInvalidChars && (
				<p className="mt-3 px-1 text-[12px] font-light leading-5 text-black/45">
					닉네임은 한글·영문·숫자만 쓸 수 있어요. 공백이나 특수문자를 빼고
					검색해 주세요.
				</p>
			)}

			{!hasInvalidChars && trimmed.length === 0 && (
				<p className="mt-3 px-1 text-[12px] font-light leading-5 text-black/40">
					찾고 싶은 회원의 닉네임을 입력해 보세요.
				</p>
			)}

			{!hasInvalidChars && trimmed.length > 0 && (
				<div className="mt-3">
					{isFetching && (
						<div className="flex items-center gap-2 px-1 text-[12px] text-black/40">
							<StarttooLoader variant="mark" label={null} /> 검색 중…
						</div>
					)}

					{!isFetching && isError && (
						<p className="px-1 text-[12px] text-brand">{errorMessage}</p>
					)}

					{!isFetching && !isError && results.length === 0 && (
						<p className="px-1 text-[12px] font-light text-black/40">
							검색 결과가 없습니다.
						</p>
					)}

					<ul className="flex flex-col">
						{results.map((account) => (
							<li key={account.userSeq}>
								<Link
									to={profilePath(account.userSeq)}
									className="flex items-center gap-3 rounded-[10px] px-1 py-2 transition hover:bg-black/5">
									<img
										src={resolveAvatar(null, account.nickname)}
										alt=""
										className="size-9 shrink-0 rounded-full bg-[#D9D9D9] object-cover"
									/>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-[13px] font-semibold text-black">
											{account.nickname}
										</span>
										{account.role === "ARTIST" && (
											<span className="block text-[11px] font-light text-black/40">
												타투이스트
											</span>
										)}
									</span>
								</Link>
							</li>
						))}
					</ul>
				</div>
			)}
		</aside>
	);
}
