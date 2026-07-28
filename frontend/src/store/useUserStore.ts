import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MeResponse } from "../types/user";
import { apiGenderToUi } from "../utils/userGender";

export type Gender = "male" | "female" | null;

type UserState = {
	nickname: string;
	birthDate: string;
	gender: Gender;
	avatarUrl: string | null;
	/** GET /users/me 응답으로 로컬 표시 상태 동기화 */
	syncFromMe: (me: MeResponse) => void;
	clearProfile: () => void;
};

const emptyProfile = {
	nickname: "",
	birthDate: "",
	gender: null as Gender,
	avatarUrl: null as string | null,
};

/**
 * 로그인 사용자 표시용 프로필 캐시.
 * 서버 원본은 GET /users/me — useSyncMeProfile이 store에 반영한다.
 */
const useUserStore = create<UserState>()(
	persist(
		(set) => ({
			...emptyProfile,
			syncFromMe: (me) =>
				set({
					nickname: me.nickname,
					birthDate: me.birthDate ?? "",
					gender: apiGenderToUi(me.gender),
					avatarUrl: me.profileImageUrl,
				}),
			clearProfile: () => set(emptyProfile),
		}),
		{ name: "starttoo-user" },
	),
);

export default useUserStore;
