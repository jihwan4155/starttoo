import { useState } from "react";
import { Link } from "react-router-dom";
import ArtistBadge from "../common/ArtistBadge";
import { CloseIcon, SearchIcon } from "./icons";
import StarttooLoader from "../loader/StarttooLoader";
import useAccountSearch from "../../hooks/queries/useAccountSearch";
import { ApiError } from "../../services/api";
import { isSearchableQuery } from "../../types/search";
import { profilePath, resolveAvatar } from "../../utils/profile";

/**
 * 커뮤니티 우측 유저 검색 패널 — 모든 회원을 닉네임으로 찾는다.
 *
 * GET /search/accounts (한 글자부터)를 쓴다.
 *
 * 응답에 프로필 이미지와 verified가 함께 오므로 실제 사진과 인증 뱃지를 그대로
 * 보여준다. 뱃지는 role이 아니라 verified만 본다 — role만 보면 심사 전 계정에도
 * 뱃지가 붙는다.
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
			{/* 제목 대신 placeholder 가 무엇을 찾는 칸인지 말한다 — 입력하면 사라지는
			    안내라 목록이 뜬 뒤에는 자리를 차지하지 않는다 */}
			<div className="flex h-10 items-center gap-2 rounded-full bg-white pl-4 pr-2 shadow-sm">
				<SearchIcon size={16} className="shrink-0 text-black/40" />
				<input
					value={value}
					onChange={(e) => setValue(e.target.value)}
					placeholder="회원 검색 → 예: 모노라인"
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
										src={resolveAvatar(
											account.profileImageUrl,
											account.nickname,
										)}
										alt=""
										className="size-9 shrink-0 rounded-full bg-white object-cover"
									/>
									<span className="min-w-0 flex-1">
										<span className="flex items-center gap-1.5">
											<span className="min-w-0 truncate text-[13px] font-semibold text-black">
												{account.nickname}
											</span>
											{account.verified && <ArtistBadge size={13} />}
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
