import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { RequestedRole } from "../types/auth";

/**
 * 소셜 로그인에서 signupRequired=true를 받은 뒤 가입 완료까지 이어지는 상태.
 *
 * 가입 플로우가 여러 화면에 걸쳐 있어 새로고침에도 살아남아야 하므로 sessionStorage에 둔다.
 * 탭을 닫으면 사라지는 편이 안전해서 localStorage는 쓰지 않는다.
 * 어디까지 진행했는지는 별도 단계 값 없이 채워진 항목으로 판단한다.
 */
type SignupState = {
	/** POST /auth/social/login 응답의 단기 가입 토큰 */
	signupToken: string | null;
	/** 서버가 +82 E.164로 정규화해 돌려준 번호 */
	phoneNumber: string | null;
	nickname: string | null;
	/**
	 * 가입 때 고른 역할.
	 *
	 * users.role은 가입 요청에서만 정해지고 이후 바꾸는 API가 없다. 그래서 역할을
	 * 가입 화면에서 묻고, 온보딩은 그 결과를 여기서 읽어 매장 정보 단계를 띄울지
	 * 판단한다. 세션 사용자(GET /users/me)로도 알 수 있지만 가입 직후에는 아직
	 * 안 채워져 있어 경합이 생긴다.
	 */
	role: RequestedRole | null;
	setSignupToken: (token: string) => void;
	setPhoneNumber: (phoneNumber: string) => void;
	setNickname: (nickname: string) => void;
	setRole: (role: RequestedRole) => void;
	clearSignup: () => void;
};

const useSignupStore = create<SignupState>()(
	persist(
		(set) => ({
			signupToken: null,
			phoneNumber: null,
			nickname: null,
			role: null,
			setSignupToken: (signupToken) => set({ signupToken }),
			setPhoneNumber: (phoneNumber) => set({ phoneNumber }),
			setNickname: (nickname) => set({ nickname }),
			setRole: (role) => set({ role }),
			clearSignup: () =>
				set({
					signupToken: null,
					phoneNumber: null,
					nickname: null,
					role: null,
				}),
		}),
		{
			name: "starttoo-signup",
			storage: createJSONStorage(() => sessionStorage),
		},
	),
);

export default useSignupStore;
