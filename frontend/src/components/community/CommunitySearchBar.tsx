import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CameraIcon, CloseIcon, SearchIcon } from "./icons";
import ActionButton from "../common/ActionButton";
import ArchivePickerModal from "./ArchivePickerModal";
import useRequireAuth from "../../hooks/useRequireAuth";
import useRecentSearches from "../../hooks/queries/useRecentSearches";
import { recentSearchesQueryKey } from "../../hooks/queries/useRecentSearches";
import {
	deleteRecentSearch,
	saveRecentSearch,
} from "../../services/userApi";
import { ApiError } from "../../services/api";
import { SEARCH_CATEGORIES } from "../../constants/community";
import useAuthStore from "../../store/useAuthStore";

/** 커뮤니티 상단 검색 바 */
export default function CommunitySearchBar() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const containerRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [value, setValue] = useState("");
	const [isFocused, setFocused] = useState(false);
	const [isCameraOpen, setCameraOpen] = useState(false);
	const [isArchiveOpen, setArchiveOpen] = useState(false);
	const accessToken = useAuthStore((s) => s.accessToken);
	const { requireAuth } = useRequireAuth();
	const { data: recentItems = [] } = useRecentSearches();

	useEffect(() => {
		if (!isCameraOpen) return undefined;
		const handleDown = (e: MouseEvent) => {
			if (!containerRef.current?.contains(e.target as Node)) {
				setCameraOpen(false);
			}
		};
		document.addEventListener("mousedown", handleDown);
		return () => document.removeEventListener("mousedown", handleDown);
	}, [isCameraOpen]);

	const handleImageSelected = (file: File) => {
		if (!file.type.startsWith("image/")) return;
		setCameraOpen(false);
		navigate(`/posts/search?q=${encodeURIComponent("사진 검색")}`);
	};

	const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) handleImageSelected(file);
		e.target.value = "";
	};

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		const file = e.dataTransfer.files?.[0];
		if (file) handleImageSelected(file);
	};

	const suggestions = value.trim()
		? SEARCH_CATEGORIES.filter((s) =>
				s.toLowerCase().includes(value.trim().toLowerCase()),
			)
		: [];

	const persistSearch = async (keyword: string) => {
		if (!accessToken) return;
		try {
			await saveRecentSearch({ keyword });
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

	const handleDeleteRecent = async (recentSearchId: number) => {
		try {
			await deleteRecentSearch(recentSearchId);
			await queryClient.invalidateQueries({ queryKey: recentSearchesQueryKey });
		} catch (err) {
			window.alert(
				err instanceof ApiError
					? err.message
					: "최근 검색어 삭제에 실패했습니다.",
			);
		}
	};

	return (
		<div ref={containerRef} className="relative w-full max-w-[520px]">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					submit(value);
				}}
				className="flex h-9 items-center gap-2 rounded-full bg-white pl-4 pr-2 shadow-sm">
				<SearchIcon size={16} className="shrink-0 text-black/40" />
				<input
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onFocus={() => {
						setFocused(true);
						setCameraOpen(false);
					}}
					onBlur={() => setFocused(false)}
					placeholder="도안, 스타일로 검색 → 예: 미니멀 라인 나비"
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
				<button
					type="button"
					aria-label="사진으로 검색"
					onClick={() => setCameraOpen((prev) => !prev)}
					className={`shrink-0 rounded-full p-1 transition ${
						isCameraOpen ? "text-brand" : "text-black/45 hover:text-black"
					}`}>
					<CameraIcon size={18} />
				</button>
			</form>

			{isCameraOpen && (
				<div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 rounded-[14px] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.15)]">
					<div
						role="presentation"
						onClick={() => fileInputRef.current?.click()}
						onDragOver={(e) => e.preventDefault()}
						onDrop={handleDrop}
						className="flex h-[180px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-black/15 transition hover:border-brand/40">
						<p className="text-center text-[13px] font-light leading-6 text-black/40">
							드래그 또는 클릭해 사진 업로드
							<br />
							JPG, JPEG, PNG, WEBP 형식 지원
							<br />
							<span className="text-[11px]">
								(이미지 검색 API 준비 중 — 키워드 검색을 이용해 주세요)
							</span>
						</p>
					</div>
					<div className="mt-5 flex justify-center gap-4">
						<ActionButton
							variant="outline"
							onClick={() => fileInputRef.current?.click()}>
							컴퓨터에서 선택
						</ActionButton>
						<ActionButton
							onClick={() =>
								requireAuth(() => {
									setCameraOpen(false);
									setArchiveOpen(true);
								})
							}>
							보관함에서 선택
						</ActionButton>
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						className="hidden"
						onChange={handleFileChange}
					/>
				</div>
			)}

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
								{SEARCH_CATEGORIES.map((category) => (
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
							{accessToken && recentItems.length > 0 ? (
								<ul className="mt-1.5">
									{recentItems.map((item) => (
										<li
											key={item.recentSearchId}
											className="flex items-center justify-between">
											<button
												type="button"
												onClick={() => submit(item.keyword)}
												className="flex-1 rounded-lg px-2 py-2 text-left text-[13px] font-light text-black transition hover:bg-black/5">
												{item.keyword}
											</button>
											<button
												type="button"
												aria-label={`${item.keyword} 삭제`}
												onClick={() =>
													void handleDeleteRecent(item.recentSearchId)
												}
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

			<ArchivePickerModal
				isOpen={isArchiveOpen}
				onClose={() => setArchiveOpen(false)}
				onSelect={(item) => {
					const label =
						item.primaryStyle?.trim() ||
						item.secondaryStyle?.trim() ||
						"보관함 도안";
					submit(label);
				}}
			/>
		</div>
	);
}
