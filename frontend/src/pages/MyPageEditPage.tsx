import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import useUpdateMe from "../hooks/mutations/useUpdateMe";
import useUpdateArtist from "../hooks/mutations/useUpdateArtist";
import useUpdateProfileImage from "../hooks/mutations/useUpdateProfileImage";
import useMe from "../hooks/queries/useMe";
import useMyArtistProfile from "../hooks/queries/useMyArtistProfile";
import useRequireAuth from "../hooks/useRequireAuth";
import StarttooLoader from "../components/loader/StarttooLoader";
import ArtistShopProfileSection from "../components/mypage/ArtistShopProfileSection";
import {
	buildArtistShopPatch,
	hasArtistShopChanges,
	toArtistShopForm,
	EMPTY_ARTIST_SHOP_FORM,
	type ArtistShopFormValues,
} from "../components/mypage/artistShopPatch";
import { checkNicknameAvailability } from "../services/authApi";
import { ApiError } from "../services/api";
import { type Gender } from "../store/useUserStore";
import type { UpdateMeRequest } from "../types/user";
import { birthDateMessage, formatBirthDigits } from "../utils/birthDate";
import { dataUrlToFile } from "../utils/dataUrlToFile";
import { cropImageToDataUrl, DEFAULT_CROP } from "../utils/image";
import { resolveAvatar } from "../utils/profile";
import { apiGenderToUi, uiGenderToApi } from "../utils/userGender";
import LoadingLabel from "../components/loader/LoadingLabel";

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

/**
 * 프로필 수정 — PATCH /users/me, PATCH /users/me/profile-image,
 * PATCH /artists/me/profile (타투이스트)
 */
export default function MyPageEditPage() {
	const navigate = useNavigate();
	const { requireAuth, isAuthenticated } = useRequireAuth();
	const {
		data: me,
		isPending: isMePending,
		isError: isMeError,
		error: meError,
	} = useMe();
	const { mutateAsync: saveProfile, isPending: isSavingProfile } = useUpdateMe();
	const { mutateAsync: saveArtist, isPending: isSavingArtist } = useUpdateArtist();
	const { mutateAsync: saveProfileImage, isPending: isSavingImage } =
		useUpdateProfileImage();

	const avatarInputRef = useRef<HTMLInputElement>(null);
	const [nicknameInput, setNicknameInput] = useState("");
	// 온보딩과 같은 방식 — 화면의 하이픈은 표시용이고 상태에는 숫자만 담는다.
	const [birthDigits, setBirthDigits] = useState("");
	const [genderInput, setGenderInput] = useState<Gender>(null);
	const [avatarInput, setAvatarInput] = useState<string | null>(null);
	/** 중복 확인 결과 — ok면 회색, 아니면 빨강으로 보여준다 */
	const [nicknameCheck, setNicknameCheck] = useState<{
		ok: boolean;
		message: string;
	} | null>(null);
	const [formError, setFormError] = useState<string | null>(null);
	const [shopForm, setShopForm] = useState<ArtistShopFormValues>(
		EMPTY_ARTIST_SHOP_FORM,
	);

	// artistProfile은 role=ARTIST이고 artists 확장 행이 있을 때만 내려온다.
	const artist = me?.artist;
	// 도시·주소·전화·영업 안내는 공개 목록(GET /artists)에서만 읽어올 수 있다.
	// 인증 전이면 null이라 매장명 말고는 프리필하지 못한다.
	const { data: artistDetail, isPending: isArtistDetailPending } =
		useMyArtistProfile(me?.userId ?? 0, Boolean(artist));
	// 저장이 전체 덮어쓰기라, 프리필한 이 값이 "안 건드리면 그대로 남을 값"이다.
	const shopBaseline = toArtistShopForm(artistDetail, artist);

	useEffect(() => {
		if (!me) return;
		setNicknameInput(me.nickname);
		// 서버는 YYYY-MM-DD로 주므로 하이픈을 떼어 숫자만 남긴다.
		setBirthDigits((me.birthDate ?? "").replace(/\D/g, "").slice(0, 8));
		setGenderInput(apiGenderToUi(me.gender));
		setAvatarInput(me.profileImageUrl);
		setNicknameCheck(null);
		setFormError(null);
	}, [me]);

	// 숍 폼은 조회가 끝난 뒤 채운다 — 먼저 채우면 사용자가 입력하는 중에 덮어쓴다.
	useEffect(() => {
		if (!artist || isArtistDetailPending) return;
		setShopForm(toArtistShopForm(artistDetail, artist));
	}, [artist, artistDetail, isArtistDetailPending]);

	const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file || !file.type.startsWith("image/")) return;
		setAvatarInput(
			await cropImageToDataUrl(file, DEFAULT_CROP, { outputSize: 300 }),
		);
		setNicknameCheck(null);
	};

	const handleCheckNickname = async () => {
		const trimmed = nicknameInput.trim();
		if (!trimmed) {
			setNicknameCheck({ ok: false, message: "닉네임을 입력해 주세요." });
			return;
		}
		if (me && trimmed === me.nickname) {
			// 고칠 것이 없는 안내라 빨강으로 띄우지 않는다.
			setNicknameCheck({ ok: true, message: "현재 사용 중인 닉네임입니다." });
			return;
		}
		try {
			const result = await checkNicknameAvailability(trimmed);
			setNicknameCheck(
				result.available
					? { ok: true, message: "사용 가능한 닉네임입니다." }
					: { ok: false, message: "이미 사용 중인 닉네임입니다." },
			);
		} catch (err) {
			setNicknameCheck({
				ok: false,
				message:
					err instanceof ApiError ? err.message : "중복 확인에 실패했습니다.",
			});
		}
	};

	const birthError = birthDateMessage(birthDigits);
	/** 8자리를 채우는 중 — 아직 저장할 수 없다 */
	const birthIncomplete = birthDigits.length > 0 && birthDigits.length < 8;
	/**
	 * 저장해도 되는 생년월일인지.
	 *
	 * 비워 두는 것은 허용한다 — 온보딩 전에 만들어진 계정은 생년월일이 없을 수 있어,
	 * 필수로 만들면 닉네임만 바꾸려는 사람까지 막힌다. 대신 값을 넣었다면 가입과 같은
	 * 기준(달력에 있는 날짜 · 미래가 아닌 날짜)을 지켜야 한다.
	 */
	const birthReady =
		birthDigits.length === 0 || (!birthIncomplete && birthError === null);

	const handleSave = async () => {
		if (!requireAuth()) return;
		if (!me) return;

		setFormError(null);
		const trimmedNickname = nicknameInput.trim();
		if (!trimmedNickname) {
			setFormError("닉네임을 입력해 주세요.");
			return;
		}
		if (!birthReady) {
			setFormError(birthError ?? "생년월일을 숫자 8자리로 입력해 주세요.");
			return;
		}

		try {
			const avatarChanged = Boolean(avatarInput?.startsWith("data:"));

			// nickname은 서버 필수라 바뀌지 않아도 항상 실어 보낸다.
			const patchBody: UpdateMeRequest = { nickname: trimmedNickname };
			let hasProfileChanges = trimmedNickname !== me.nickname;

			// 8자리를 통과했으면 그 결과가 곧 서버가 받는 YYYY-MM-DD다.
			const nextBirthDate =
				birthDigits.length === 8 ? formatBirthDigits(birthDigits) : null;
			if (nextBirthDate !== (me.birthDate ?? null)) {
				patchBody.birthDate = nextBirthDate;
				hasProfileChanges = true;
			}

			// 서버 값(M·F 또는 과거 MALE·FEMALE)을 같은 코드 공간으로 맞춰 비교한다.
			const nextGender = uiGenderToApi(genderInput) ?? null;
			const currentGender = uiGenderToApi(apiGenderToUi(me.gender)) ?? null;
			if (nextGender !== currentGender) {
				patchBody.gender = nextGender;
				hasProfileChanges = true;
			}

			const hasArtistChanges = Boolean(
				artist && hasArtistShopChanges(shopForm, shopBaseline),
			);

			if (!hasProfileChanges && !avatarChanged && !hasArtistChanges) {
				setFormError("변경된 내용이 없습니다.");
				return;
			}

			if (avatarChanged && avatarInput) {
				const file = dataUrlToFile(avatarInput, "profile");
				await saveProfileImage(file);
			}

			if (hasProfileChanges) {
				await saveProfile(patchBody);
			}

			if (hasArtistChanges) {
				await saveArtist(buildArtistShopPatch(shopForm));
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
	const usesDefaultAvatar = !avatarInput;

	// 비로그인이면 useMe가 꺼져 있어 isPending이 계속 true다 — 로그인 여부를 먼저 본다.
	if (!isAuthenticated) {
		return (
			<div className="min-h-[calc(100vh-var(--nav-h))] bg-surface px-6 pb-16 pt-10">
				<p className="py-20 text-center text-[14px] text-black/60">
					로그인 후 프로필을 수정할 수 있습니다.
				</p>
			</div>
		);
	}

	if (isMePending) {
		return (
			<div className="min-h-[calc(100vh-var(--nav-h))] bg-surface px-6 pb-16 pt-10">
				<StarttooLoader variant="block" label="프로필을 불러오는 중…" />
			</div>
		);
	}

	if (isMeError || !me) {
		return (
			<div className="min-h-[calc(100vh-var(--nav-h))] bg-surface px-6 pb-16 pt-10">
				<p className="py-20 text-center text-[14px] text-black/60">
					{meError instanceof ApiError
						? meError.message
						: "프로필을 불러오지 못했습니다."}
				</p>
			</div>
		);
	}

	return (
		<div className="min-h-[calc(100vh-var(--nav-h))] bg-surface px-6 pb-16 pt-10">
			<div className="mx-auto w-full max-w-[560px]">
				<button
					type="button"
					onClick={() => avatarInputRef.current?.click()}
					aria-label="프로필 이미지 변경"
					className={`relative block size-[84px] overflow-hidden rounded-full ${usesDefaultAvatar ? "bg-white" : "bg-[#D9D9D9]"}`}>
					<img
						src={displayAvatar}
						alt=""
						className={`size-full ${usesDefaultAvatar ? "object-contain" : "object-cover"}`}
					/>
					<span className="absolute inset-x-0 bottom-0 flex h-7 items-center justify-center bg-black/50">
						<CameraIcon />
					</span>
				</button>				<input
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
								setNicknameCheck(null);
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
					{/* 통과 안내는 회색 — 빨강은 고쳐야 할 것에만 쓴다 */}
					{nicknameCheck && (
						<p
							{...(nicknameCheck.ok ? {} : { role: "alert" as const })}
							className={`mt-2 text-[13px] ${
								nicknameCheck.ok ? "text-black/55" : "text-brand"
							}`}>
							{nicknameCheck.message}
						</p>
					)}
				</div>

				<div className="mt-6 flex gap-6">
					<div className="flex-1">
						<p className="text-[16px] font-bold text-black">생년월일</p>
						{/* 온보딩과 같은 숫자 8자리 입력 — 달력으로 몇십 년을 거스르는 것보다 빠르다 */}
						<input
							value={formatBirthDigits(birthDigits)}
							onChange={(e) =>
								setBirthDigits(e.target.value.replace(/\D/g, "").slice(0, 8))
							}
							inputMode="numeric"
							autoComplete="bday"
							placeholder="YYYYMMDD"
							// 하이픈 2개까지 포함한 길이 — 하이픈은 우리가 끼운다
							maxLength={10}
							aria-invalid={birthError !== null}
							aria-describedby="mypage-birthdate-help"
							className="mt-2 h-[52px] w-full rounded-[10px] border border-black/10 bg-white px-4 text-[14px] text-black outline-none placeholder:text-black/35 focus:border-brand/50"
						/>
						{birthError ? (
							<p
								id="mypage-birthdate-help"
								role="alert"
								className="mt-2 text-[13px] text-brand">
								{birthError}
							</p>
						) : (
							<p
								id="mypage-birthdate-help"
								className="mt-2 text-[13px] text-black/55">
								숫자 8자리로 입력해주세요.
							</p>
						)}
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

				{artist && (
					<ArtistShopProfileSection
						values={shopForm}
						onChange={(patch) =>
							setShopForm((prev) => ({ ...prev, ...patch }))
						}
						verificationStatus={artist.verificationStatus}
						isPrefilled={Boolean(artistDetail)}
					/>
				)}

				{me.role === "ARTIST" && !artist && (
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
						disabled={isSaving || !birthReady}
						className="h-[46px] min-w-[110px] rounded-full bg-brand text-[15px] font-semibold text-white transition hover:brightness-95 disabled:opacity-50">
						{isSaving ? <LoadingLabel>저장 중…</LoadingLabel> : "저장"}
					</button>
				</div>
			</div>
		</div>
	);
}
