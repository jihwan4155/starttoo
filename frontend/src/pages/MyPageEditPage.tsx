import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import useUpdateMe from "../hooks/mutations/useUpdateMe";
import useUpdateArtist from "../hooks/mutations/useUpdateArtist";
import useUpdateProfileImage from "../hooks/mutations/useUpdateProfileImage";
import useMe from "../hooks/queries/useMe";
import useRequireAuth from "../hooks/useRequireAuth";
import StarttooLoader from "../components/loader/StarttooLoader";
import ArtistShopProfileSection, {
	buildArtistShopPatch,
	type ArtistShopFormValues,
} from "../components/mypage/ArtistShopProfileSection";
import { checkNicknameAvailability } from "../services/authApi";
import { ApiError } from "../services/api";
import { type Gender } from "../store/useUserStore";
import { dataUrlToFile } from "../utils/dataUrlToFile";
import { cropImageToDataUrl, DEFAULT_CROP } from "../utils/image";
import { resolveAvatar } from "../utils/profile";
import { apiGenderToUi, uiGenderToApi } from "../utils/userGender";

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

/** 프로필 수정 — PATCH /users/me, PUT profile-image, PATCH /artists/me (타투이스트) */
export default function MyPageEditPage() {
	const navigate = useNavigate();
	const { requireAuth } = useRequireAuth();
	const { data: me, isPending: isMePending, isError: isMeError } = useMe();
	const { mutateAsync: saveProfile, isPending: isSavingProfile } = useUpdateMe();
	const { mutateAsync: saveArtist, isPending: isSavingArtist } = useUpdateArtist();
	const { mutateAsync: saveProfileImage, isPending: isSavingImage } =
		useUpdateProfileImage();

	const avatarInputRef = useRef<HTMLInputElement>(null);
	const [nicknameInput, setNicknameInput] = useState("");
	const [birthDateInput, setBirthDateInput] = useState("");
	const [genderInput, setGenderInput] = useState<Gender>(null);
	const [avatarInput, setAvatarInput] = useState<string | null>(null);
	const [serverAvatarUrl, setServerAvatarUrl] = useState<string | null>(null);
	const [nicknameCheckMessage, setNicknameCheckMessage] = useState<
		string | null
	>(null);
	const [formError, setFormError] = useState<string | null>(null);
	const [shopForm, setShopForm] = useState<ArtistShopFormValues>({
		shopName: "",
		shopCity: "",
		shopAddress: "",
		shopPhone: "",
		businessHours: "",
	});

	const isArtist = me?.role === "ARTIST";
	const artist = me?.artist;

	useEffect(() => {
		if (!me) return;
		setNicknameInput(me.nickname);
		setBirthDateInput(me.birthDate ?? "");
		setGenderInput(apiGenderToUi(me.gender));
		setAvatarInput(me.profileImageUrl);
		setServerAvatarUrl(me.profileImageUrl);
		setNicknameCheckMessage(null);
		setFormError(null);
		if (me.artist) {
			setShopForm({
				shopName: me.artist.shopName ?? "",
				shopCity: me.artist.shopCity ?? "",
				shopAddress: me.artist.shopAddress ?? "",
				shopPhone: me.artist.shopPhone ?? "",
				businessHours: me.artist.businessHours ?? "",
			});
		}
	}, [me]);

	const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file || !file.type.startsWith("image/")) return;
		setAvatarInput(await cropImageToDataUrl(file, DEFAULT_CROP, 300));
		setNicknameCheckMessage(null);
	};

	const handleCheckNickname = async () => {
		const trimmed = nicknameInput.trim();
		if (!trimmed) {
			setNicknameCheckMessage("닉네임을 입력해 주세요.");
			return;
		}
		if (me && trimmed === me.nickname) {
			setNicknameCheckMessage("현재 사용 중인 닉네임입니다.");
			return;
		}
		try {
			const result = await checkNicknameAvailability(trimmed);
			setNicknameCheckMessage(
				result.available
					? "사용 가능한 닉네임입니다."
					: "이미 사용 중인 닉네임입니다.",
			);
		} catch (err) {
			setNicknameCheckMessage(
				err instanceof ApiError
					? err.message
					: "중복 확인에 실패했습니다.",
			);
		}
	};

	const handleSave = async () => {
		if (!requireAuth()) return;
		if (!me) return;

		setFormError(null);
		const trimmedNickname = nicknameInput.trim();
		if (!trimmedNickname) {
			setFormError("닉네임을 입력해 주세요.");
			return;
		}

		try {
			const avatarChanged =
				avatarInput?.startsWith("data:") ||
				avatarInput !== serverAvatarUrl;

			const patchBody: Parameters<typeof saveProfile>[0] = {};
			if (trimmedNickname !== me.nickname) {
				patchBody.nickname = trimmedNickname;
			}
			if (birthDateInput !== (me.birthDate ?? "")) {
				if (birthDateInput) {
					patchBody.birthDate = birthDateInput;
				} else {
					patchBody.removeBirthDate = true;
				}
			}
			const nextGender = uiGenderToApi(genderInput);
			const currentGender = me.gender ?? undefined;
			if (nextGender !== currentGender) {
				if (nextGender) {
					patchBody.gender = nextGender;
				} else if (me.gender) {
					patchBody.removeGender = true;
				}
			}

			const artistPatch =
				isArtist && artist
					? buildArtistShopPatch(shopForm, artist)
					: {};
			const hasUserChanges =
				Object.keys(patchBody).length > 0 || avatarChanged;
			const hasArtistChanges = Object.keys(artistPatch).length > 0;

			if (!hasUserChanges && !hasArtistChanges) {
				setFormError("변경된 내용이 없습니다.");
				return;
			}

			if (avatarInput?.startsWith("data:")) {
				const file = dataUrlToFile(avatarInput, "profile.webp");
				await saveProfileImage(file);
			}

			if (Object.keys(patchBody).length > 0) {
				await saveProfile(patchBody);
			}

			if (hasArtistChanges) {
				await saveArtist(artistPatch);
			}

			navigate("/mypage");
		} catch (err) {
			setFormError(
				err instanceof ApiError
					? err.message
					: err instanceof Error
						? err.message
						: "저장에 실패했습니다.",
			);
		}
	};

	const isSaving = isSavingProfile || isSavingImage || isSavingArtist;
	const displayAvatar = resolveAvatar(avatarInput, nicknameInput);

	if (isMePending) {
		return (
			<div className="min-h-[calc(100vh-60px)] bg-surface px-6 pb-16 pt-10">
				<StarttooLoader variant="block" label="프로필을 불러오는 중…" />
			</div>
		);
	}

	if (isMeError || !me) {
		return (
			<div className="min-h-[calc(100vh-60px)] bg-surface px-6 pb-16 pt-10">
				<p className="py-20 text-center text-[14px] text-black/60">
					{requireAuth()
						? "프로필을 불러오지 못했습니다."
						: "로그인 후 프로필을 수정할 수 있습니다."}
				</p>
			</div>
		);
	}

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface px-6 pb-16 pt-10">
			<div className="mx-auto w-full max-w-[560px]">
				<button
					type="button"
					onClick={() => avatarInputRef.current?.click()}
					aria-label="프로필 이미지 변경"
					className="relative block size-[100px] overflow-hidden rounded-full bg-[#D9D9D9]">
					<img
						src={displayAvatar}
						alt=""
						className="size-full object-cover"
					/>
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
							onChange={(e) => {
								setNicknameInput(e.target.value);
								setNicknameCheckMessage(null);
							}}
							placeholder="닉네임"
							className="h-[52px] min-w-0 flex-1 rounded-[10px] border border-black/10 bg-white px-4 text-[14px] text-black outline-none placeholder:text-black/35 focus:border-brand/50"
						/>
						<button
							type="button"
							onClick={() => void handleCheckNickname()}
							className="h-[52px] shrink-0 whitespace-nowrap rounded-[10px] bg-brand/15 px-5 text-[14px] font-semibold text-brand transition hover:bg-brand/25">
							중복확인
						</button>
					</div>
					{nicknameCheckMessage && (
						<p className="mt-2 text-[13px] text-black/55">
							{nicknameCheckMessage}
						</p>
					)}
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

				{isArtist && artist && (
					<ArtistShopProfileSection
						values={shopForm}
						onChange={(patch) =>
							setShopForm((prev) => ({ ...prev, ...patch }))
						}
						approvalStatus={artist.approvalStatus}
						rejectionReason={artist.rejectionReason}
					/>
				)}

				{isArtist && !artist && (
					<p className="mt-10 border-t border-black/10 pt-10 text-[13px] text-black/50">
						타투이스트 숍 프로필이 등록되어 있지 않아 숍 정보를 수정할 수
						없습니다.
					</p>
				)}

				{formError && (
					<p className="mt-6 text-[13px] text-red-600">{formError}</p>
				)}

				<div className="mt-10 flex justify-end gap-3">
					<button
						type="button"
						onClick={() => navigate("/mypage")}
						disabled={isSaving}
						className="h-[46px] min-w-[110px] rounded-full border border-black/15 text-[15px] font-semibold text-black/60 transition hover:bg-black/5 disabled:opacity-50">
						취소
					</button>
					<button
						type="button"
						onClick={() => void handleSave()}
						disabled={isSaving}
						className="h-[46px] min-w-[110px] rounded-full bg-brand text-[15px] font-semibold text-white transition hover:brightness-95 disabled:opacity-50">
						{isSaving ? "저장 중…" : "저장"}
					</button>
				</div>
			</div>
		</div>
	);
}
