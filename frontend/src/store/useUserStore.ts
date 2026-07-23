import { create } from "zustand";
import { persist } from "zustand/middleware";
import defaultProfileImage from "../assets/images/default-profile.png";

export type Gender = "male" | "female" | null;

type UserState = {
	nickname: string;
	birthDate: string;
	gender: Gender;
	avatarUrl: string | null;
	setProfile: (profile: {
		nickname: string;
		birthDate: string;
		gender: Gender;
		avatarUrl: string | null;
	}) => void;
};

/**
 * 현재 로그인한 사용자(목업) 정보. 마이페이지·게시글 작성 등에서 공유된다.
 * TODO: 백엔드 연동 시 GET/PATCH /users/me 로 교체
 */
const useUserStore = create<UserState>()(
	persist(
		(set) => ({
			// 최초 가입 시 기본 프로필 이미지 (TODO: 로그인 연동 시 실제 가입 플로우로 교체)
			nickname: "스누피",
			birthDate: "2001-05-27",
			gender: "female",
			avatarUrl: defaultProfileImage,
			setProfile: (profile) => set(profile),
		}),
		{ name: "starttoo-user" },
	),
);

export default useUserStore;
