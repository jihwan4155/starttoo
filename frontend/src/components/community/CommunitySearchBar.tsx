import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CameraIcon, CloseIcon, SearchIcon } from "./icons";
import ActionButton from "../common/ActionButton";
import {
	MOCK_CATEGORIES,
	MOCK_RECENT_SEARCHES,
	MOCK_SUGGESTIONS,
} from "../../mocks/community";

/** 커뮤니티 상단 검색 바 (추천 카테고리 · 최근 검색어 · 자동완성 · 사진 검색) */
export default function CommunitySearchBar() {
	const navigate = useNavigate();
	const containerRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [value, setValue] = useState("");
	const [isFocused, setFocused] = useState(false);
	const [isCameraOpen, setCameraOpen] = useState(false);
	// TODO: 최근 검색어 API(/users/me/recent-searches) 연동
	const [recentSearches, setRecentSearches] = useState(MOCK_RECENT_SEARCHES);

	// 사진 검색 패널 바깥 클릭 시 닫기
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

	// TODO: 이미지 검색 API 연동 — 현재는 업로드 시 그리드로 이동만
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

			{/* 사진(카메라) 검색 패널 */}
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
						</p>
					</div>
					<div className="mt-5 flex justify-center gap-4">
						<ActionButton
							variant="outline"
							onClick={() => fileInputRef.current?.click()}>
							컴퓨터에서 선택
						</ActionButton>
						{/* TODO: 보관함 연동되면 보관함 선택 모달로 교체 */}
						<ActionButton onClick={() => setCameraOpen(false)}>
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
