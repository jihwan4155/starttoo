import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import useUserStore, { type Gender } from "../store/useUserStore";
import { cropImageToDataUrl, DEFAULT_CROP } from "../utils/image";

function CameraIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="#ffffff"
			strokeWidth="1.8"
			strokeLinejoin="round"
			aria-hidden>
			<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.3-2h5.4L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
			<circle cx="12" cy="12.5" r="3.4" />
		</svg>
	);
}

/** 프로필 수정 — 저장 시 useUserStore에 반영되어 마이페이지에 바로 노출된다 */
export default function MyPageEditPage() {
	const navigate = useNavigate();
	const nickname = useUserStore((s) => s.nickname);
	const birthDate = useUserStore((s) => s.birthDate);
	const gender = useUserStore((s) => s.gender);
	const avatarUrl = useUserStore((s) => s.avatarUrl);
	const setProfile = useUserStore((s) => s.setProfile);

	const avatarInputRef = useRef<HTMLInputElement>(null);
	const [nicknameInput, setNicknameInput] = useState(nickname);
	const [birthDateInput, setBirthDateInput] = useState(birthDate);
	const [genderInput, setGenderInput] = useState<Gender>(gender);
	const [avatarInput, setAvatarInput] = useState(avatarUrl);

	const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file || !file.type.startsWith("image/")) return;
		setAvatarInput(await cropImageToDataUrl(file, DEFAULT_CROP, 300));
	};

	const handleSave = () => {
		setProfile({
			nickname: nicknameInput.trim() || nickname,
			birthDate: birthDateInput,
			gender: genderInput,
			avatarUrl: avatarInput,
		});
		navigate("/mypage");
	};

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface px-6 pb-16 pt-10">
			<div className="mx-auto w-full max-w-[560px]">
				<button
					type="button"
					onClick={() => avatarInputRef.current?.click()}
					aria-label="프로필 이미지 변경"
					className="relative block size-[100px] overflow-hidden rounded-full bg-[#D9D9D9]">
					{avatarInput && (
						<img
							src={avatarInput}
							alt=""
							className="size-full object-cover"
						/>
					)}
					<span className="absolute inset-x-0 bottom-0 flex h-8 items-center justify-center bg-black/50">
						<CameraIcon />
					</span>
				</button>
				<input
					ref={avatarInputRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={handleAvatarChange}
				/>

				<div className="mt-8">
					<p className="text-[16px] font-bold text-black">닉네임</p>
					<div className="mt-2 flex gap-2">
						<input
							value={nicknameInput}
							onChange={(e) => setNicknameInput(e.target.value)}
							placeholder="닉네임"
							className="h-[52px] min-w-0 flex-1 rounded-[10px] border border-black/10 bg-white px-4 text-[14px] text-black outline-none placeholder:text-black/35 focus:border-brand/50"
						/>
						{/* TODO: 닉네임 중복확인 API 연동 */}
						<button
							type="button"
							className="h-[52px] shrink-0 whitespace-nowrap rounded-[10px] bg-brand/15 px-5 text-[14px] font-semibold text-brand transition hover:bg-brand/25">
							중복확인
						</button>
					</div>
				</div>

				<div className="mt-6 flex gap-6">
					<div className="flex-1">
						<p className="text-[16px] font-bold text-black">생년월일</p>
						<input
							type="date"
							value={birthDateInput}
							onChange={(e) => setBirthDateInput(e.target.value)}
							className="mt-2 h-[52px] w-full rounded-[10px] border border-black/10 bg-white px-4 text-[14px] text-black outline-none focus:border-brand/50"
						/>
					</div>
					<div className="flex-1">
						<p className="text-[16px] font-bold text-black">성별</p>
						<div className="mt-2 flex gap-2">
							<button
								type="button"
								onClick={() => setGenderInput("male")}
								aria-pressed={genderInput === "male"}
								className={`h-[52px] flex-1 rounded-[10px] text-[14px] font-semibold transition ${
									genderInput === "male"
										? "bg-brand text-white"
										: "border border-black/10 bg-white text-black/60 hover:bg-black/5"
								}`}>
								남성
							</button>
							<button
								type="button"
								onClick={() => setGenderInput("female")}
								aria-pressed={genderInput === "female"}
								className={`h-[52px] flex-1 rounded-[10px] text-[14px] font-semibold transition ${
									genderInput === "female"
										? "bg-brand text-white"
										: "border border-black/10 bg-white text-black/60 hover:bg-black/5"
								}`}>
								여성
							</button>
						</div>
					</div>
				</div>

				<div className="mt-10 flex justify-end gap-3">
					<button
						type="button"
						onClick={() => navigate("/mypage")}
						className="h-[46px] min-w-[110px] rounded-full border border-black/15 text-[15px] font-semibold text-black/60 transition hover:bg-black/5">
						취소
					</button>
					<button
						type="button"
						onClick={handleSave}
						className="h-[46px] min-w-[110px] rounded-full bg-brand text-[15px] font-semibold text-white transition hover:brightness-95">
						저장
					</button>
				</div>
			</div>
		</div>
	);
}
